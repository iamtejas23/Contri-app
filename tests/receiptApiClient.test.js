import assert from 'node:assert/strict'
import test from 'node:test'

import { requestReceiptApiWithAuth } from '../src/lib/receiptApiClient.js'

const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })

test('receipt API uses a freshly refreshed Firebase ID token and retries once after an expired-token response', async () => {
  const tokens = []
  const headers = []
  const user = { async getIdToken(forceRefresh) { tokens.push(forceRefresh); return `fresh-${tokens.length}` } }
  const result = await requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: { fileId: 'stable-file-id' },
    fetchImpl: async (_url, options) => {
      headers.push(options.headers.Authorization)
      return headers.length === 1
        ? response(401, { error: 'Token expired.' })
        : response(200, { ok: true })
    },
  })

  assert.deepEqual(tokens, [true, true])
  assert.deepEqual(headers, ['Bearer fresh-1', 'Bearer fresh-2'])
  assert.deepEqual(result, { ok: true })
})

test('receipt API returns the server authorization error after the one refresh retry', async () => {
  let calls = 0
  const user = { async getIdToken(forceRefresh) { assert.equal(forceRefresh, true); return `fresh-${calls++}` } }
  await assert.rejects(requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: {},
    fetchImpl: async () => response(401, { error: 'This account cannot upload receipts.' }),
  }), /This account cannot upload receipts/)
  assert.equal(calls, 2)
})

test('receipt API preserves network failures as actionable retry errors', async () => {
  const user = { async getIdToken() { return 'fresh-token' } }
  await assert.rejects(requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: {},
    fetchImpl: async () => { throw new TypeError('offline') },
  }), /unreachable.*retry the same image/i)
})

test('receipt API does not send a request when token refresh itself fails', async () => {
  let requests = 0
  const user = { async getIdToken(forceRefresh) { assert.equal(forceRefresh, true); throw new Error('refresh failure') } }
  await assert.rejects(requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: {},
    fetchImpl: async () => { requests += 1; return response(200, {}) },
  }), /session could not be refreshed/i)
  assert.equal(requests, 0)
})

test('receipt API returns successful verification payloads', async () => {
  const user = { async getIdToken(forceRefresh) { assert.equal(forceRefresh, true); return 'valid-id-token' } }
  const result = await requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/verify',
    payload: { fileId: 'verified-id' },
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer valid-id-token')
      return response(200, { receipt: { fileId: 'verified-id' } })
    },
  })
  assert.deepEqual(result, { receipt: { fileId: 'verified-id' } })
})
