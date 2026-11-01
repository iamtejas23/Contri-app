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

const makeAnonymousUser = async () => {
  const { response, payload } = await requestJson(`${authBase}/accounts:signUp?key=emulator-test-key`, {
    body: { returnSecureToken: true },
  })
  assert.equal(response.status, 200, JSON.stringify(payload))
  return payload
}

const seedDocument = async (path, fields) => {
  const { response, payload } = await requestJson(`${firestoreBase}/${path}`, {
    method: 'PATCH', body: { fields: encodeFirestoreFields(fields) },
  })
  assert.ok(response.ok, `Could not seed emulator fixture: ${JSON.stringify(payload)}`)
}

const seedMemberUploadPermission = async (enabled) => seedDocument(`trips/${ownerTripId}`, {
  createdBy: creator.localId,
  memberIds: [creator.localId, member.localId, guest.localId],
  adminIds: [creator.localId],
  allowMemberReceiptUploads: enabled,
})

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
let guest
let ownerTripId
let otherTripId
let expenseId
let memberExpenseId
let storageCalls
let storedObjects

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
    if (!storedObjects.has(path)) return { data: null, error: { statusCode: '404' } }
    return { data: storedObjects.get(path), error: null }
  },
  async remove(paths) {
    storageCalls.push(['remove', ...paths])
    return { data: paths.map((name) => ({ name })), error: null }
  },
})

before(async () => {
  storedObjects = new Map()
  creator = await makeUser('tsmane8787@gmail.com', true)
  member = await makeUser('trip-member@example.test', true)
  outsider = await makeUser('outsider@example.test', true)
  guest = await makeAnonymousUser()
  ownerTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  otherTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  expenseId = `expense-${randomUUID().replaceAll('-', '')}`
  memberExpenseId = `expense-${randomUUID().replaceAll('-', '')}`
  await seedDocument(`trips/${ownerTripId}`, {
    createdBy: creator.localId,
    memberIds: [creator.localId, member.localId, guest.localId],
    adminIds: [creator.localId],
  })
  await seedDocument(`trips/${ownerTripId}/expenses/${expenseId}`, { title: 'Receipt test', amount: 100 })
  await seedDocument(`trips/${ownerTripId}/expenses/${memberExpenseId}`, {
    title: 'Attached receipt',
    receiptFiles: {
      supabase_receipt_001: {
        provider: 'supabase', bucket: 'contri-receipts', fileId: 'supabase_receipt_001',
        path: `trips/${ownerTripId}/expenses/${memberExpenseId}/supabase_receipt_001.jpg`,
        thumbnailPath: `trips/${ownerTripId}/expenses/${memberExpenseId}/supabase_receipt_001.thumb.jpg`,
        thumbnailMimeType: 'image/jpeg', thumbnailSize: 20_000,
        fileName: 'receipt.jpg', mimeType: 'image/jpeg', size: 1000,
      },
      legacy_receipt_002: {
        provider: 'supabase', bucket: 'contri-receipts', fileId: 'legacy_receipt_002',
        path: `trips/${ownerTripId}/expenses/${memberExpenseId}/legacy_receipt_002.png`,
        fileName: 'old.png', mimeType: 'image/png', size: 1500,
      },
    },
  })
  await seedDocument(`trips/${otherTripId}`, { createdBy: member.localId, memberIds: [member.localId], adminIds: [member.localId] })
  await seedDocument(`trips/${otherTripId}/expenses/${expenseId}`, { title: 'Other account expense' })
})

test('verified authorized trip creator gets one scoped upload token for a valid image', async () => {
  storageCalls = []
  const fileId = randomUUID()
  const result = await invoke({
    handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, mimeType: 'image/jpeg', size: 1024, fileName: 'photo.jpg' },
    dependencies: { createStorage },
  })
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.bucket, 'contri-receipts')
  assert.equal(result.body.path, `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.jpg`)
  assert.equal(result.body.token, 'one-object-test-token')
  assert.equal(storageCalls[0][0], 'info')
  assert.deepEqual(storageCalls[1], ['upload', result.body.path, { upsert: false }])
  assert.equal(Object.hasOwn(result.body, 'serviceRoleKey'), false)
})

test('non-owner, unverified identity, unsupported type and oversized uploads are rejected before signing', async () => {
  storageCalls = []
  const nonOwner = await invoke({ handler: uploadHandler, token: member.idToken, body: { tripId: ownerTripId, expenseId, mimeType: 'image/png', size: 1 }, dependencies: { createStorage } })
  const unsupported = await invoke({ handler: uploadHandler, token: creator.idToken, body: { tripId: ownerTripId, expenseId, mimeType: 'application/pdf', size: 1 }, dependencies: { createStorage } })
  const tooLarge = await invoke({ handler: uploadHandler, token: creator.idToken, body: { tripId: ownerTripId, expenseId, mimeType: 'image/png', size: 5 * 1024 * 1024 + 1 }, dependencies: { createStorage } })
  const unverifiedUser = await makeUser('unverified-owner@example.test')
  const unverifiedTrip = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  const unverifiedExpense = `expense-${randomUUID().replaceAll('-', '')}`
  await seedDocument(`trips/${unverifiedTrip}`, { createdBy: unverifiedUser.localId, memberIds: [unverifiedUser.localId] })
  await seedDocument(`trips/${unverifiedTrip}/expenses/${unverifiedExpense}`, { title: 'No upload' })
  const unverified = await invoke({ handler: uploadHandler, token: unverifiedUser.idToken, body: { tripId: unverifiedTrip, expenseId: unverifiedExpense, fileId: randomUUID(), mimeType: 'image/png', size: 1 }, dependencies: { createStorage } })
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
  storedObjects.set(path, { contentType: 'image/jpeg', size: 1000 })
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

test('upload retry reuses its stable path and does not request an overwrite token', async () => {
  storageCalls = []
  const fileId = randomUUID()
  const path = `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.png`
  const missing = await invoke({ handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, mimeType: 'image/png', size: 1000, fileName: 'receipt.png' }, dependencies: { createStorage } })
  assert.equal(missing.statusCode, 200)
  assert.equal(missing.body.alreadyUploaded, undefined)
  storedObjects.set(path, { contentType: 'image/png', size: 1000 })
  const retry = await invoke({ handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, mimeType: 'image/png', size: 1000, fileName: 'receipt.png' }, dependencies: { createStorage } })
  assert.equal(retry.statusCode, 200)
  assert.equal(retry.body.alreadyUploaded, true)
  assert.equal(retry.body.path, path)
  assert.equal(storageCalls.filter(([kind]) => kind === 'upload').length, 1)
})

test('upload rejects declared files over the 5 MiB cap and invalid retry IDs', async () => {
  storageCalls = []
  const tooLarge = await invoke({ handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId: randomUUID(), mimeType: 'image/png', size: 5 * 1024 * 1024 + 1 }, dependencies: { createStorage } })
  const invalidId = await invoke({ handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId: '../receipt', mimeType: 'image/png', size: 1000 }, dependencies: { createStorage } })
  assert.equal(tooLarge.statusCode, 400)
  assert.match(tooLarge.body.error, /5 MB/)
  assert.equal(invalidId.statusCode, 400)
  assert.equal(storageCalls.length, 0)
})

test('the exact 5 MiB boundary remains eligible for a signed upload', async () => {
  storageCalls = []
  const result = await invoke({ handler: uploadHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId: randomUUID(), mimeType: 'image/webp', size: 5 * 1024 * 1024, fileName: 'receipt.webp' }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.size, 5 * 1024 * 1024)
  assert.equal(storageCalls.filter(([kind]) => kind === 'upload').length, 1)
})

test('thumbnail objects use a separate private path and a strict lightweight size limit', async () => {
  storageCalls = []
  const fileId = randomUUID()
  const body = { tripId: ownerTripId, expenseId, fileId, assetType: 'thumbnail', mimeType: 'image/jpeg', size: 120_000, fileName: 'receipt-thumbnail.jpg' }
  const allowed = await invoke({ handler: uploadHandler, token: creator.idToken, body, dependencies: { createStorage } })
  assert.equal(allowed.statusCode, 200)
  assert.equal(allowed.body.path, `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.thumb.jpg`)
  const tooLarge = await invoke({ handler: uploadHandler, token: creator.idToken,
    body: { ...body, fileId: randomUUID(), size: 256 * 1024 + 1 }, dependencies: { createStorage } })
  assert.equal(tooLarge.statusCode, 400)
})

test('verified receipt metadata includes only a verified canonical thumbnail sidecar', async () => {
  storageCalls = []
  const fileId = randomUUID()
  const path = `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.png`
  const thumbnailPath = `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.thumb.jpg`
  storedObjects.set(path, { contentType: 'image/png', size: 2048 })
  storedObjects.set(thumbnailPath, { contentType: 'image/jpeg', size: 42_000 })
  const result = await invoke({ handler: verifyHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, path, mimeType: 'image/png', thumbnailPath }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.receipt.thumbnailPath, thumbnailPath)
  assert.equal(result.body.receipt.thumbnailSize, 42_000)
  const forged = await invoke({ handler: verifyHandler, token: creator.idToken,
    body: { tripId: ownerTripId, expenseId, fileId, path, mimeType: 'image/png', thumbnailPath: `${thumbnailPath}.other` }, dependencies: { createStorage } })
  assert.equal(forged.statusCode, 400)
  storedObjects.delete(path)
  storedObjects.delete(thumbnailPath)
})

test('member receipt upload is denied by default for a legacy trip with no permission flag', async () => {
  storageCalls = []
  const result = await invoke({ handler: uploadHandler, token: member.idToken,
    body: { tripId: ownerTripId, expenseId, fileId: randomUUID(), mimeType: 'image/png', size: 1000, fileName: 'member.png' }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 403)
  assert.equal(result.body.code, 'TRIP_AUTHORIZATION_FAILED')
  assert.equal(storageCalls.length, 0)
})

test('current authenticated member can upload and verify when the trip creator enabled permission', async () => {
  storageCalls = []
  const fileId = randomUUID()
  const path = `trips/${ownerTripId}/expenses/${expenseId}/${fileId}.png`
  await seedMemberUploadPermission(true)
  try {
    const upload = await invoke({ handler: uploadHandler, token: member.idToken,
      body: { tripId: ownerTripId, expenseId, fileId, mimeType: 'image/png', size: 1200, fileName: 'member.png' }, dependencies: { createStorage } })
    assert.equal(upload.statusCode, 200)
    storedObjects.set(path, { contentType: 'image/png', size: 1200 })
    const verified = await invoke({ handler: verifyHandler, token: member.idToken,
      body: { tripId: ownerTripId, expenseId, fileId, path, mimeType: 'image/png', fileName: 'member.png' }, dependencies: { createStorage } })
    assert.equal(verified.statusCode, 200)
    assert.equal(verified.body.receipt.fileId, fileId)
  } finally {
    await seedMemberUploadPermission(false)
    storedObjects.delete(path)
  }
})

test('guest and non-member uploaders are rejected even when member upload is enabled', async () => {
  await seedMemberUploadPermission(true)
  storageCalls = []
  const body = { tripId: ownerTripId, expenseId, fileId: randomUUID(), mimeType: 'image/png', size: 1000 }
  const guestUpload = await invoke({ handler: uploadHandler, token: guest.idToken, body, dependencies: { createStorage } })
  const outsiderUpload = await invoke({ handler: uploadHandler, token: outsider.idToken, body, dependencies: { createStorage } })
  const guestView = await invoke({ handler: urlHandler, token: guest.idToken,
    body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001' }, dependencies: { createStorage } })
  assert.equal(guestUpload.statusCode, 403)
  assert.equal(outsiderUpload.statusCode, 403)
  assert.equal(guestView.statusCode, 403)
  assert.equal(storageCalls.length, 0)
  await seedMemberUploadPermission(false)
})

test('a member removed from the trip immediately loses receipt upload access', async () => {
  await seedDocument(`trips/${ownerTripId}`, {
    createdBy: creator.localId,
    memberIds: [creator.localId, guest.localId],
    adminIds: [creator.localId],
    allowMemberReceiptUploads: true,
  })
  storageCalls = []
  const result = await invoke({ handler: uploadHandler, token: member.idToken,
    body: { tripId: ownerTripId, expenseId, fileId: randomUUID(), mimeType: 'image/png', size: 1000 }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 403)
  assert.equal(storageCalls.length, 0)
  await seedMemberUploadPermission(false)
})

test('trip members receive cached-preview-compatible short-lived URLs for attached original and thumbnail files', async () => {
  storageCalls = []
  const result = await invoke({ handler: urlHandler, token: member.idToken,
    body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001' }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 200)
  assert.match(result.body.preview, /short-lived/)
  assert.notEqual(result.body.thumbnail, result.body.preview)
  assert.match(result.body.download, /short-lived/)
  assert.equal(storageCalls.filter(([kind]) => kind === 'sign').length, 3)
  assert.ok(storageCalls.some((call) => call[0] === 'sign' && call[1].endsWith('supabase_receipt_001.thumb.jpg')))
  assert.equal(storageCalls.every((call) => call[2] === 120), true)
})

test('legacy receipt metadata without a thumbnail remains viewable using its original private file', async () => {
  storageCalls = []
  const result = await invoke({ handler: urlHandler, token: member.idToken,
    body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'legacy_receipt_002' }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.thumbnail, result.body.preview)
  assert.equal(storageCalls.filter(([kind]) => kind === 'sign').length, 2)
})

test('receipt list requests sign only the lightweight thumbnail object', async () => {
  storageCalls = []
  const result = await invoke({ handler: urlHandler, token: member.idToken,
    body: { tripId: ownerTripId, expenseId: memberExpenseId, fileId: 'supabase_receipt_001', purpose: 'thumbnail' }, dependencies: { createStorage } })
  assert.equal(result.statusCode, 200)
  assert.ok(result.body.thumbnail.includes('short-lived'))
  assert.equal(result.body.download, undefined)
  assert.equal(storageCalls.filter(([kind]) => kind === 'sign').length, 1)
  assert.ok(storageCalls.some((call) => call[0] === 'sign' && call[1].endsWith('supabase_receipt_001.thumb.jpg')))
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
  assert.deepEqual(storageCalls.at(-1), ['remove', `trips/${ownerTripId}/expenses/${memberExpenseId}/supabase_receipt_001.jpg`, `trips/${ownerTripId}/expenses/${memberExpenseId}/supabase_receipt_001.thumb.jpg`])
})

test('missing Supabase server key fails closed without storage access', async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const result = await invoke({ handler: uploadHandler, token: creator.idToken,
      body: { tripId: ownerTripId, expenseId, fileId: randomUUID(), mimeType: 'image/png', size: 10 },
    })
    assert.equal(result.statusCode, 503)
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previous
  }
})
