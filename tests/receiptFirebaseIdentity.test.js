import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import test from 'node:test'

import { getBearerToken, verifyFirebaseIdentity } from '../api/_lib/firebase.js'

const mockResponse = (status, payload) => ({ ok: status >= 200 && status < 300, status, json: async () => payload })
const makeToken = (claims, payload = {}) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${payload.signature || 'signature'}`
const validToken = makeToken({ aud: 'demo-contri-notifications', iss: 'https://securetoken.google.com/demo-contri-notifications', sub: 'uid-1' })

test('Firebase identity verification returns the UID and verified email from the token lookup response', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  let requestUrl = ''
  const identity = await verifyFirebaseIdentity(validToken, async (url, options) => {
    requestUrl = url
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { idToken: validToken })
    return mockResponse(200, { users: [{ localId: 'uid-1', email: 'owner@example.com', emailVerified: true, providerUserInfo: [{}] }] })
  })
  const expectedBase = process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:lookup`
    : 'https://identitytoolkit.googleapis.com/v1/accounts:lookup'
  assert.equal(requestUrl, `${expectedBase}?key=test-web-api-key`)
  assert.deepEqual(identity, { uid: 'uid-1', email: 'owner@example.com', emailVerified: true, isAnonymous: false })
})

test('production Identity Toolkit URL does not duplicate the host in the path', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  const previousEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST
  try {
    let requestUrl = ''
    await verifyFirebaseIdentity(validToken, async (url) => {
      requestUrl = url
      return mockResponse(200, { users: [{ localId: 'uid-1' }] })
    })
    assert.equal(requestUrl, 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-web-api-key')
  } finally {
    if (previousEmulator === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previousEmulator
  }
})

test('Firebase token audience and issuer must match the configured project', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  let lookedUp = false
  const tokenFromOtherProject = makeToken({ aud: 'another-project', iss: 'https://securetoken.google.com/another-project', sub: 'uid-1' })
  await assert.rejects(verifyFirebaseIdentity(tokenFromOtherProject, async () => { lookedUp = true; return mockResponse(200, {}) }),
    (error) => error.statusCode === 401 && error.code === 'FIREBASE_PROJECT_MISMATCH')
  assert.equal(lookedUp, false)
})

test('Firebase expired-token errors are distinguished from server configuration errors', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(400, {
    error: { message: 'TOKEN_EXPIRED' },
  })), (error) => error.statusCode === 401 && error.code === 'FIREBASE_TOKEN_EXPIRED')

  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(400, {
    error: { message: 'API_KEY_INVALID' },
  })), (error) => error.statusCode === 503 && error.code === 'FIREBASE_CONFIG_ERROR')
})

test('Firebase unavailable errors remain retryable and do not expose provider response details', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(503, {
    error: { message: 'INTERNAL_SERVER_ERROR: private diagnostic' },
  })), (error) => error.statusCode === 503 && error.code === 'FIREBASE_VERIFY_UNAVAILABLE'
    && !error.message.includes('private diagnostic'))
})

test('Firebase lookup service network errors have a distinct safe category', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  await assert.rejects(verifyFirebaseIdentity(validToken, async () => { throw new Error('private network detail') }),
    (error) => error.statusCode === 503 && error.code === 'FIREBASE_VERIFY_UNAVAILABLE'
      && !error.message.includes('private network detail'))
})

test('Firebase lookup UID must match the signed token subject', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(200, {
    users: [{ localId: 'different-user', email: 'someone@example.com' }],
  })), (error) => error.statusCode === 401 && error.code === 'FIREBASE_TOKEN_INVALID')
})

test('receipt API distinguishes missing and malformed bearer headers', () => {
  assert.throws(() => getBearerToken({ headers: {} }), (error) => error.code === 'AUTH_MISSING')
  assert.throws(() => getBearerToken({ headers: { authorization: 'Basic token' } }), (error) => error.code === 'AUTH_MALFORMED')
  assert.throws(() => getBearerToken({ headers: { authorization: 'Bearer token with spaces' } }), (error) => error.code === 'AUTH_MALFORMED')
})
