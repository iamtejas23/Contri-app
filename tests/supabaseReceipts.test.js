import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import test, { before } from 'node:test'

import uploadHandler from '../api/supabase/upload.js'
import verifyHandler from '../api/supabase/verify.js'
import urlHandler from '../api/supabase/url.js'
import deleteHandler from '../api/supabase/delete.js'
import { encodeFirestoreFields } from '../api/_lib/firebase.js'

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-contri-notifications'
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const authBase = `http://${authHost.replace(/^https?:\/\//, '')}/identitytoolkit.googleapis.com/v1`
const firestoreBase = `http://${firestoreHost.replace(/^https?:\/\//, '')}/v1/projects/${projectId}/databases/(default)/documents`

process.env.FIREBASE_PROJECT_ID = projectId
process.env.FIREBASE_WEB_API_KEY = 'emulator-test-key'

const requestJson = async (url, { method = 'POST', body, token } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method === 'PATCH' ? { Authorization: 'Bearer owner' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

const makeUser = async (email, emailVerified = false) => {
  const { response, payload } = await requestJson(`${authBase}/accounts:signUp?key=emulator-test-key`, {
    body: { email, password: 'receipt-test-password', returnSecureToken: true },
  })
  assert.equal(response.status, 200, JSON.stringify(payload))
  if (!emailVerified) return payload
  await requestJson(`${authBase}/accounts:sendOobCode?key=emulator-test-key`, {
    body: { idToken: payload.idToken, requestType: 'VERIFY_EMAIL' },
  })
  const oob = await requestJson(`http://${authHost.replace(/^https?:\/\//, '')}/emulator/v1/projects/${projectId}/oobCodes`, { method: 'GET' })
  const verificationCode = oob.payload.oobCodes?.find((item) => item.email === email)?.oobCode
  assert.ok(verificationCode)
  const action = await fetch(`http://${authHost.replace(/^https?:\/\//, '')}/emulator/action?mode=verifyEmail&oobCode=${encodeURIComponent(verificationCode)}&apiKey=fake-api-key`)
  assert.equal(action.status, 200)
  const signedIn = await requestJson(`${authBase}/accounts:signInWithPassword?key=emulator-test-key`, {
    body: { email, password: 'receipt-test-password', returnSecureToken: true },
  })
  assert.equal(signedIn.response.status, 200, JSON.stringify(signedIn.payload))
  return signedIn.payload
}

const seedDocument = async (path, fields) => {
  const { response, payload } = await requestJson(`${firestoreBase}/${path}`, {
    method: 'PATCH', body: { fields: encodeFirestoreFields(fields) },
  })
  assert.ok(response.ok, `Could not seed emulator fixture: ${JSON.stringify(payload)}`)
}

const invoke = async ({ handler, token, body, dependencies = {} }) => {
  const req = { method: 'POST', headers: { authorization: token ? `Bearer ${token}` : '' }, body }
  const result = { statusCode: 200, headers: {}, body: null }
  const res = {
    setHeader(name, value) { result.headers[name] = value },
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
    end() { return this },
  }
  await handler(req, res, dependencies)
  return result
}

let creator
let member
let outsider
let ownerTripId
let otherTripId
let expenseId
let memberExpenseId
let storageCalls

const createStorage = () => ({
  async createSignedUploadUrl(path, options) {
    storageCalls.push(['upload', path, options])
    return { data: { token: 'one-object-test-token', path }, error: null }
  },
  async createSignedUrl(path, seconds, options) {
    storageCalls.push(['sign', path, seconds, options])
    return { data: { signedUrl: `https://private.test/${encodeURIComponent(path)}?token=short-lived` }, error: null }
  },
  async info(path) {
    storageCalls.push(['info', path])
    return { data: { contentType: 'image/jpeg', size: 1000 }, error: null }
  },
  async remove(paths) {
    storageCalls.push(['remove', ...paths])
    return { data: paths.map((name) => ({ name })), error: null }
  },
})

before(async () => {
  creator = await makeUser('tsmane8787@gmail.com', true)
  member = await makeUser('trip-member@example.test', true)
  outsider = await makeUser('outsider@example.test', true)
  ownerTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  otherTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  expenseId = `expense-${randomUUID().replaceAll('-', '')}`
  memberExpenseId = `expense-${randomUUID().replaceAll('-', '')}`
  await seedDocument(`trips/${ownerTripId}`, {
    createdBy: creator.localId,
    memberIds: [creator.localId, member.localId],
    adminIds: [creator.localId],
  })
  await seedDocument(`trips/${ownerTripId}/expenses/${expenseId}`, { title: 'Receipt test', amount: 100 })
  await seedDocument(`trips/${ownerTripId}/expenses/${memberExpenseId}`, {
    title: 'Attached receipt',
    receiptFiles: {
      supabase_receipt_001: {
        provider: 'supabase', bucket: 'contri-receipts', fileId: 'supabase_receipt_001',
        path: `trips/${ownerTripId}/expenses/${memberExpenseId}/supabase_receipt_001.jpg`,
        fileName: 'receipt.jpg', mimeType: 'image/jpeg', size: 1000,
      },
    },
  })
  await seedDocument(`trips/${otherTripId}`, { createdBy: member.localId, memberIds: [member.localId], adminIds: [member.localId] })
  await seedDocument(`trips/${otherTripId}/expenses/${expenseId}`, { title: 'Other account expense' })
})

test('verified authorized trip creator gets one scoped upload token for a valid image', async () => {
  storageCalls = []
  const result = await invoke({
    handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, mimeType: 'image/jpeg', size: 1024, fileName: 'photo.jpg' },
    dependencies: { createStorage },
  })
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.bucket, 'contri-receipts')
  assert.match(result.body.path, new RegExp(`^trips/${ownerTripId}/expenses/${expenseId}/[a-f0-9-]+\\.jpg$`))
  assert.equal(result.body.token, 'one-object-test-token')
  assert.equal(storageCalls[0][0], 'upload')
  assert.deepEqual(storageCalls[0][2], { upsert: false })
  assert.equal(Object.hasOwn(result.body, 'serviceRoleKey'), false)
})

test('non-owner, unverified identity, unsupported type and oversized uploads are rejected before signing', async () => {
  storageCalls = []
  const nonOwner = await invoke({ handler: uploadHandler, token: member.idToken, body: { tripId: ownerTripId, expenseId, mimeType: 'image/png', size: 1 }, dependencies: { createStorage } })
  const unsupported = await invoke({ handler: uploadHandler, token: creator.idToken, body: { tripId: ownerTripId, expenseId, mimeType: 'application/pdf', size: 1 }, dependencies: { createStorage } })
  const tooLarge = await invoke({ handler: uploadHandler, token: creator.idToken, body: { tripId: ownerTripId, expenseId, mimeType: 'image/png', size: 50_000_001 }, dependencies: { createStorage } })
  const unverifiedUser = await makeUser('unverified-owner@example.test')
  const unverifiedTrip = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  const unverifiedExpense = `expense-${randomUUID().replaceAll('-', '')}`
  await seedDocument(`trips/${unverifiedTrip}`, { createdBy: unverifiedUser.localId, memberIds: [unverifiedUser.localId] })
  await seedDocument(`trips/${unverifiedTrip}/expenses/${unverifiedExpense}`, { title: 'No upload' })
  const unverified = await invoke({ handler: uploadHandler, token: unverifiedUser.idToken, body: { tripId: unverifiedTrip, expenseId: unverifiedExpense, mimeType: 'image/png', size: 1 }, dependencies: { createStorage } })
  assert.equal(nonOwner.statusCode, 403)
  assert.equal(unsupported.statusCode, 400)
  assert.equal(tooLarge.statusCode, 400)
  assert.equal(unverified.statusCode, 403)
  assert.equal(storageCalls.length, 0)
})

test('creator can attach only a completed storage object with matching type and size', async () => {
  storageCalls = []
  const fileId = randomUUID()
  const path = `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.jpg`
  const verified = await invoke({ handler: verifyHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, path, mimeType: 'image/jpeg', fileName: 'receipt.jpg' }, dependencies: { createStorage } })
  assert.equal(verified.statusCode, 200)
  assert.equal(verified.body.receipt.path, path)
  assert.equal(verified.body.receipt.provider, 'supabase')
  const wrongType = await invoke({ handler: verifyHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, path, mimeType: 'image/png' }, dependencies: { createStorage } })
  assert.equal(wrongType.statusCode, 400)
  assert.equal(storageCalls.filter(([kind]) => kind === 'info').length, 1)
})

test('trip members get short-lived private view and download URLs only for attached Supabase receipts', async () => {
  storageCalls = []
  const result = await invoke({ handler: urlHandler, token: member.idToken,
    body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001' }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 200)
  assert.match(result.body.preview, /short-lived/)
  assert.equal(result.body.thumbnail, result.body.preview)
  assert.match(result.body.download, /short-lived/)
  assert.equal(storageCalls.filter(([kind]) => kind === 'sign').length, 2)
  assert.equal(storageCalls.every((call) => call[2] === 120), true)
})

test('outsiders, invalid tokens, unlinked IDs and legacy/non-Supabase metadata cannot read private storage', async () => {
  const outsiderResult = await invoke({ handler: urlHandler, token: outsider.idToken, body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001' }, dependencies: { createStorage } })
  const invalidToken = await invoke({ handler: urlHandler, token: 'invalid-token', body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001' }, dependencies: { createStorage } })
  const missing = await invoke({ handler: urlHandler, token: member.idToken, body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'missing_receipt' }, dependencies: { createStorage } })
  assert.equal(outsiderResult.statusCode, 403)
  assert.equal(invalidToken.statusCode, 401)
  assert.equal(missing.statusCode, 404)
})

test('only trip admins can delete attached Supabase receipt objects', async () => {
  storageCalls = []
  const body = { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001' }
  const denied = await invoke({ handler: deleteHandler, token: member.idToken, body, dependencies: { createStorage } })
  assert.equal(denied.statusCode, 403)
  assert.equal(storageCalls.length, 0)
  const allowed = await invoke({ handler: deleteHandler, token: creator.idToken, body, dependencies: { createStorage } })
  assert.equal(allowed.statusCode, 200)
  assert.deepEqual(storageCalls.at(-1), ['remove', `trips/${ownerTripId}/expenses/${memberExpenseId}/supabase_receipt_001.jpg`])
})

test('missing Supabase server key fails closed without storage access', async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const result = await invoke({ handler: uploadHandler, token: creator.idToken,
      body: { tripId: ownerTripId, expenseId, mimeType: 'image/png', size: 10 },
    })
    assert.equal(result.statusCode, 503)
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previous
  }
})
