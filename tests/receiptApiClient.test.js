import assert from 'node:assert/strict'
import test from 'node:test'

import { requestReceiptApiWithAuth } from '../src/lib/receiptApiClient.js'

const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })

test('receipt API sends the cached Firebase ID token and refreshes only after a classified expired-token response', async () => {
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
        ? response(401, { error: 'The Firebase ID token expired.', code: 'FIREBASE_TOKEN_EXPIRED' })
        : response(200, { ok: true })
    },
  })

  assert.deepEqual(tokens, [false, true])
  assert.deepEqual(headers, ['Bearer fresh-1', 'Bearer fresh-2'])
  assert.deepEqual(result, { ok: true })
})

test('receipt API returns the server authorization error after the one refresh retry', async () => {
  let calls = 0
  const user = { async getIdToken(forceRefresh) { assert.equal(forceRefresh, calls > 0); return `fresh-${calls++}` } }
  await assert.rejects(requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: {},
    fetchImpl: async () => response(401, { error: 'The token expired.', code: 'FIREBASE_TOKEN_INVALID', requestId: 'req-safe-1' }),
  }), /The token expired.*FIREBASE_TOKEN_INVALID.*req-safe-1/)
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

test('receipt API does not refresh a token for trip authorization failures', async () => {
  let tokenCalls = 0
  const user = { async getIdToken(forceRefresh) { tokenCalls += 1; assert.equal(forceRefresh, false); return 'cached-id-token' } }
  await assert.rejects(requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: {},
    fetchImpl: async () => response(403, { error: 'Not the authorized creator.', code: 'TRIP_AUTHORIZATION_FAILED' }),
  }), /Not the authorized creator.*TRIP_AUTHORIZATION_FAILED/)
  assert.equal(tokenCalls, 1)
})

test('receipt API does not send a request when cached token retrieval fails', async () => {
  let requests = 0
  const user = { async getIdToken(forceRefresh) { assert.equal(forceRefresh, false); throw new Error('token retrieval failure') } }
  await assert.rejects(requestReceiptApiWithAuth({
    user,
    url: 'https://receipt.test/upload',
    payload: {},
    fetchImpl: async () => { requests += 1; return response(200, {}) },
  }), /could not read the current session/i)
  assert.equal(requests, 0)
})

test('receipt API returns successful verification payloads', async () => {
  const user = { async getIdToken(forceRefresh) { assert.equal(forceRefresh, false); return 'valid-id-token' } }
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
