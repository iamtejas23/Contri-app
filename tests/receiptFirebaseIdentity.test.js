import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import test from 'node:test'

import { verifyFirebaseIdentity } from '../api/_lib/firebase.js'

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
  assert.match(requestUrl, /accounts:lookup/)
  assert.deepEqual(identity, { uid: 'uid-1', email: 'owner@example.com', emailVerified: true, isAnonymous: false })
})

test('Firebase token audience and issuer must match the configured project', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  let lookedUp = false
  const tokenFromOtherProject = makeToken({ aud: 'another-project', iss: 'https://securetoken.google.com/another-project', sub: 'uid-1' })
  await assert.rejects(verifyFirebaseIdentity(tokenFromOtherProject, async () => { lookedUp = true; return mockResponse(200, {}) }),
    (error) => error.statusCode === 401 && /different or invalid project/i.test(error.message))
  assert.equal(lookedUp, false)
})

test('Firebase expired-token errors are distinguished from server configuration errors', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(400, {
    error: { message: 'TOKEN_EXPIRED' },
  })), (error) => error.statusCode === 401 && /ID token/i.test(error.message))

  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(400, {
    error: { message: 'API_KEY_INVALID' },
  })), (error) => error.statusCode === 503 && /misconfigured/i.test(error.message))
})

test('Firebase unavailable errors remain retryable and do not expose provider response details', async () => {
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key'
  await assert.rejects(verifyFirebaseIdentity(validToken, async () => mockResponse(503, {
    error: { message: 'INTERNAL_SERVER_ERROR: private diagnostic' },
  })), (error) => error.statusCode === 503 && /verify this session right now/i.test(error.message)
    && !error.message.includes('private diagnostic'))
})
