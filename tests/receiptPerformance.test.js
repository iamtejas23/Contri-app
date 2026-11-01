import assert from 'node:assert/strict'
import test from 'node:test'
import { createReceiptThumbnail, getReceiptThumbnailDimensions } from '../src/lib/receiptThumbnail.js'
import { createReceiptUrlCache } from '../src/lib/receiptUrlCache.js'
import { createReceiptUploadQueue } from '../src/lib/receiptUploadQueue.js'

const waitFor = async (predicate, timeoutMs = 2_000) => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for receipt job state.')
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
}

test('receipt preview dimensions preserve aspect ratio and cap the longest edge', async () => {
  assert.deepEqual(getReceiptThumbnailDimensions(4000, 3000), { width: 480, height: 360 })
  assert.deepEqual(getReceiptThumbnailDimensions(300, 600), { width: 240, height: 480 })
  assert.deepEqual(getReceiptThumbnailDimensions(320, 200), { width: 320, height: 200 })
  assert.equal(getReceiptThumbnailDimensions(0, 100), null)
  assert.equal(await createReceiptThumbnail(new Blob(['image'])), null, 'non-browser test environment degrades to original-only storage')
})

test('signed receipt URLs are cached, coalesced, and refreshed before expiry', async () => {
  let now = 1_000
  let calls = 0
  const cache = createReceiptUrlCache({ now: () => now })
  const load = async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { preview: `signed-${calls}`, expiresIn: 30 } }
  const [a, b] = await Promise.all([cache.get('user/trip/expense/file', load), cache.get('user/trip/expense/file', load)])
  assert.equal(a.preview, b.preview)
  assert.equal(calls, 1)
  assert.equal((await cache.get('user/trip/expense/file', load)).preview, a.preview)
  assert.equal(calls, 1)
  now += 25_000
  assert.equal((await cache.get('user/trip/expense/file', load)).preview, 'signed-2')
  assert.equal(calls, 2)
})

test('receipt queue limits concurrent uploads and emits per-file progress', async () => {
  const delayMs = 45
  let active = 0
  let peak = 0
  const queue = createReceiptUploadQueue({
    maxConcurrent: 2,
    isOnline: () => true,
    createPreviewUrl: (file) => `local:${file.name}`,
    revokePreviewUrl() {},
    run: async (job, progress) => {
      active += 1
      peak = Math.max(peak, active)
      progress(50)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      active -= 1
      return { fileId: job.fileId }
    },
  })
  const startedAt = performance.now()
  const ids = ['one.jpg', 'two.jpg', 'three.jpg'].map((name) => queue.enqueue({ tripId: 't', expenseId: 'e', file: { name } }))
  await waitFor(() => ids.every((id) => queue.getSnapshot().find((job) => job.id === id)?.status === 'complete'))
  const elapsedMs = performance.now() - startedAt
  assert.equal(peak, 2)
  assert.ok(queue.getSnapshot().every((job) => job.progress === 100))
  assert.ok(elapsedMs < delayMs * 2.7, `expected parallel completion faster than serial baseline; got ${elapsedMs.toFixed(1)} ms`)
  queue.dispose()
})

test('offline jobs wait and resume, and failed uploads can retry using the same receipt ID', async () => {
  let online = false
  let attempts = 0
  const queue = createReceiptUploadQueue({
    isOnline: () => online,
    createPreviewUrl: () => 'local:preview',
    revokePreviewUrl() {},
    run: async (job) => {
      attempts += 1
      if (attempts === 1) throw new Error('network connection failed')
      return { fileId: job.fileId }
    },
  })
  const id = queue.enqueue({ tripId: 't', expenseId: 'e', file: { name: 'offline.jpg' } })
  const originalFileId = queue.getSnapshot()[0].fileId
  assert.equal(queue.getSnapshot()[0].status, 'waiting')
  online = true
  queue.resume()
  await waitFor(() => queue.getSnapshot()[0]?.status === 'failed')
  queue.retry(id)
  await waitFor(() => queue.getSnapshot()[0]?.status === 'complete')
  assert.equal(attempts, 2)
  assert.equal(queue.getSnapshot()[0].fileId, originalFileId)
  queue.dispose()
})
