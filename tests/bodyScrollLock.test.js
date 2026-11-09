import assert from 'node:assert/strict'
import { test } from 'node:test'

import { acquireBodyScrollLock } from '../src/lib/bodyScrollLock.js'

const fakeBody = (overflow = '') => ({ style: { overflow } })

test('nested overlays keep scrolling locked until the final overlay closes', () => {
  const body = fakeBody('auto')
  const releaseNotificationPanel = acquireBodyScrollLock(body)
  const releaseConfirmationDialog = acquireBodyScrollLock(body)

  assert.equal(body.style.overflow, 'hidden')
  releaseNotificationPanel()
  assert.equal(body.style.overflow, 'hidden')
  releaseConfirmationDialog()
  assert.equal(body.style.overflow, 'auto')
})

test('overlay cleanup is idempotent and preserves a pre-existing lock', () => {
  const body = fakeBody('clip')
  const release = acquireBodyScrollLock(body)
  release()
  release()

  assert.equal(body.style.overflow, 'clip')
  const releaseAfter = acquireBodyScrollLock(body)
  assert.equal(body.style.overflow, 'hidden')
  releaseAfter()
  assert.equal(body.style.overflow, 'clip')
})

test('closing two overlays in either order restores the original body state', () => {
  for (const closeOrder of [[0, 1], [1, 0]]) {
    const body = fakeBody('')
    const releases = [acquireBodyScrollLock(body), acquireBodyScrollLock(body)]
    closeOrder.forEach((index) => releases[index]())
    assert.equal(body.style.overflow, '')
  }
})
