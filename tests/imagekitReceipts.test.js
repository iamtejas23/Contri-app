import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import test, { before } from 'node:test'

import authHandler from '../api/imagekit/auth.js'
import urlHandler from '../api/imagekit/url.js'
import deleteHandler from '../api/imagekit/delete.js'
import verifyHandler from '../api/imagekit/verify.js'
import { encodeFirestoreFields } from '../api/_lib/firebase.js'

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-contri-notifications'
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const authBase = `http://${authHost.replace(/^https?:\/\//, '')}/identitytoolkit.googleapis.com/v1`
const firestoreBase = `http://${firestoreHost.replace(/^https?:\/\//, '')}/v1/projects/${projectId}/databases/(default)/documents`

process.env.FIREBASE_PROJECT_ID = projectId
process.env.FIREBASE_WEB_API_KEY = 'emulator-test-key'
process.env.IMAGEKIT_PUBLIC_KEY = 'public_test_key'
process.env.IMAGEKIT_PRIVATE_KEY = 'private_test_only'
process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/test'
process.env.IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED = 'true'

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
  if (emailVerified) {
    const code = await requestJson(`${authBase}/accounts:sendOobCode?key=emulator-test-key`, {
      body: { idToken: payload.idToken, requestType: 'VERIFY_EMAIL' },
    })
    assert.equal(code.response.status, 200, JSON.stringify(code.payload))
    const oob = await requestJson(`http://${authHost.replace(/^https?:\/\//, '')}/emulator/v1/projects/${projectId}/oobCodes`, { method: 'GET' })
    const verificationCode = oob.payload.oobCodes?.find((item) => item.email === email)?.oobCode
    assert.ok(verificationCode, 'Auth Emulator should provide the verification code')
    const action = await fetch(`http://${authHost.replace(/^https?:\/\//, '')}/emulator/action?mode=verifyEmail&oobCode=${encodeURIComponent(verificationCode)}&apiKey=fake-api-key`)
    assert.equal(action.status, 200)
    const signedIn = await requestJson(`${authBase}/accounts:signInWithPassword?key=emulator-test-key`, {
      body: { email, password: 'receipt-test-password', returnSecureToken: true },
    })
    assert.equal(signedIn.response.status, 200, JSON.stringify(signedIn.payload))
    return signedIn.payload
  }
  return payload
}

const seedDocument = async (path, fields) => {
  const { response, payload } = await requestJson(`${firestoreBase}/${path}`, {
    method: 'PATCH',
    body: { fields: encodeFirestoreFields(fields) },
  })
  assert.ok(response.ok, `Could not seed emulator fixture: ${JSON.stringify(payload)}`)
}

const invoke = async ({ handler, token, body, origin = 'https://contri-app.vercel.app', dependencies = {} }) => {
  const headers = { authorization: token ? `Bearer ${token}` : '', origin }
  const req = { method: 'POST', headers, body }
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
let ownTripId
let otherTripId
let expenseId
let legacyRoleTripId

before(async () => {
  creator = await makeUser('tsmane8787@gmail.com', true)
  member = await makeUser('trip-member@example.test', true)
  outsider = await makeUser('outsider@example.test', true)
  ownTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  otherTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  expenseId = `expense-${randomUUID().replaceAll('-', '')}`

  await seedDocument(`trips/${ownTripId}`, {
    createdBy: creator.localId,
    memberIds: [creator.localId, member.localId],
    adminIds: [creator.localId],
    members: [
      { uid: creator.localId, role: 'admin' },
      { uid: member.localId, role: 'member' },
    ],
  })
  await seedDocument(`trips/${ownTripId}/expenses/${expenseId}`, {
    createdBy: creator.localId,
    title: 'Test expense',
    amount: 100,
    receiptFiles: {
      receipt_test_001: {
        fileId: 'receipt_test_001',
        filePath: `contri-receipts/${ownTripId}/${expenseId}/receipt.jpg`,
        mimeType: 'image/jpeg',
        fileName: 'receipt-test.jpg',
      },
    },
  })
  await seedDocument(`trips/${otherTripId}`, {
    createdBy: member.localId,
    memberIds: [member.localId],
    adminIds: [member.localId],
    members: [{ uid: member.localId, role: 'admin' }],
  })
  await seedDocument(`trips/${otherTripId}/expenses/${expenseId}`, {
    createdBy: member.localId,
    title: 'Other expense',
    amount: 50,
  })
  legacyRoleTripId = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  await seedDocument(`trips/${legacyRoleTripId}`, {
    createdBy: outsider.localId,
    memberIds: [outsider.localId, member.localId],
    members: [{ uid: outsider.localId, role: 'admin' }, { uid: member.localId, role: 'admin' }],
  })
  await seedDocument(`trips/${legacyRoleTripId}/expenses/${expenseId}`, {
    createdBy: outsider.localId,
    title: 'Legacy role expense',
    receiptFiles: {
      receipt_legacy_role: { fileId: 'receipt_legacy_role', filePath: `contri-receipts/${legacyRoleTripId}/${expenseId}/receipt.jpg` },
    },
  })
})

test('verified authorized trip creator receives a short-lived ImageKit upload signature', async () => {
  const result = await invoke({ handler: authHandler,
    token: creator.idToken,
    body: { tripId: ownTripId, expenseId, mimeType: 'image/jpeg' },
  })
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.publicKey, 'public_test_key')
  assert.equal(result.body.isPrivateFile, true)
  assert.equal(result.body.folder, `/contri-receipts/${ownTripId}/${expenseId}`)
  assert.ok(result.body.expire <= Math.floor(Date.now() / 1000) + 301)
  assert.match(result.body.signature, /^[a-f0-9]{40}$/)
  assert.equal(Object.hasOwn(result.body, 'privateKey'), false)
})

test('upload signing stays disabled until the private ImageKit upload policy is confirmed', async () => {
  const previous = process.env.IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED
  delete process.env.IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED
  try {
    const result = await invoke({ handler: authHandler, token: creator.idToken, body: { tripId: ownTripId, expenseId, mimeType: 'image/jpeg' } })
    assert.equal(result.statusCode, 503)
    assert.match(result.body.error, /private upload policy/)
  } finally {
    process.env.IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED = previous
  }
})

test('members can request temporary receipt URLs only for receipts attached to their trip expense', async () => {
  const result = await invoke({ handler: urlHandler,
    token: member.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'receipt_test_001' },
    dependencies: {
      fetchImpl: withImageKitDetails({
        fileId: 'receipt_test_001',
        filePath: `/contri-receipts/${ownTripId}/${expenseId}/receipt.jpg`,
        isPrivateFile: true,
        mime: 'image/jpeg',
        size: 1000,
      }),
    },
  })
  assert.equal(result.statusCode, 200)
  assert.match(result.body.preview, /tr:w-960,q-82,f-webp/)
  assert.match(result.body.thumbnail, /tr:w-360,q-70,f-webp/)
  assert.match(result.body.original, /ik-s=[a-f0-9]{40}/)
  assert.match(result.body.download, /ik-attachment=true/)
})

test('receipt URL endpoint refuses an attached asset that ImageKit reports as public', async () => {
  const result = await invoke({
    handler: urlHandler,
    token: member.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'receipt_test_001' },
    dependencies: {
      fetchImpl: withImageKitDetails({
        fileId: 'receipt_test_001',
        filePath: `/contri-receipts/${ownTripId}/${expenseId}/receipt.jpg`,
        isPrivateFile: false,
        mime: 'image/jpeg',
        size: 1000,
      }),
    },
  })
  assert.equal(result.statusCode, 404)
})

test('rejects upload signatures for other creators, unverified accounts and unsupported types', async () => {
  const otherCreator = await invoke({ handler: authHandler,
    token: member.idToken,
    body: { tripId: otherTripId, expenseId, mimeType: 'image/png' },
  })
  assert.equal(otherCreator.statusCode, 403)
  const notVerified = await makeUser('unverified@example.test')
  const nonVerifiedOwnerTrip = `receipt-trip-${randomUUID().replaceAll('-', '')}`
  const unverifiedExpense = `expense-${randomUUID().replaceAll('-', '')}`
  await seedDocument(`trips/${nonVerifiedOwnerTrip}`, { createdBy: notVerified.localId, memberIds: [notVerified.localId], adminIds: [notVerified.localId] })
  await seedDocument(`trips/${nonVerifiedOwnerTrip}/expenses/${unverifiedExpense}`, { title: 'Test', createdBy: notVerified.localId })
  const unverified = await invoke({ handler: authHandler, token: notVerified.idToken, body: { tripId: nonVerifiedOwnerTrip, expenseId: unverifiedExpense, mimeType: 'image/png' } })
  assert.equal(unverified.statusCode, 403)
  const unsupported = await invoke({ handler: authHandler, token: creator.idToken, body: { tripId: ownTripId, expenseId, mimeType: 'application/pdf' } })
  assert.equal(unsupported.statusCode, 400)
})

test('outsiders, invalid tokens and unattached file IDs cannot retrieve receipt URLs', async () => {
  const outsiderResult = await invoke({ handler: urlHandler,
    token: outsider.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'receipt_test_001' },
  })
  assert.equal(outsiderResult.statusCode, 403)
  const invalidToken = await invoke({ handler: urlHandler,
    token: 'not-a-valid-token',
    body: { tripId: ownTripId, expenseId, fileId: 'receipt_test_001' },
  })
  assert.equal(invalidToken.statusCode, 401)
  const missingFile = await invoke({ handler: urlHandler,
    token: member.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'not-attached' },
  })
  assert.equal(missingFile.statusCode, 404)
})

test('receipt deletion is denied to a normal member and does not call ImageKit', async () => {
  const result = await invoke({ handler: deleteHandler,
    token: member.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'receipt_test_001' },
  })
  assert.equal(result.statusCode, 403)

  const legacyRoleOnly = await invoke({ handler: deleteHandler,
    token: member.idToken,
    body: { tripId: legacyRoleTripId, expenseId, fileId: 'receipt_legacy_role' },
  })
  assert.equal(legacyRoleOnly.statusCode, 403)
})

const withImageKitDetails = (details, { onDelete = () => {} } = {}) => async (url, options = {}) => {
  if (String(url).includes('/v1/files/') && String(url).endsWith('/details')) {
    return new Response(JSON.stringify(details), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  if (String(url).includes('/v1/files/') && options.method === 'DELETE') {
    onDelete(url)
    return new Response(null, { status: 204 })
  }
  return fetch(url, options)
}

test('creator can attach only a verified private image in the expected trip and expense folder', async () => {
  const result = await invoke({
    handler: verifyHandler,
    token: creator.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'verified_private_01' },
    dependencies: {
      fetchImpl: withImageKitDetails({
        fileId: 'verified_private_01',
        filePath: `/contri-receipts/${ownTripId}/${expenseId}/receipt.jpg`,
        name: 'receipt.jpg',
        mime: 'image/jpeg',
        size: 50000,
        isPrivateFile: true,
      }),
    },
  })
  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.receipt, {
    fileId: 'verified_private_01',
    filePath: `/contri-receipts/${ownTripId}/${expenseId}/receipt.jpg`,
    fileName: 'receipt.jpg',
    mimeType: 'image/jpeg',
    size: 50000,
  })
})

test('public, misplaced, unsupported or oversized uploads are removed and never attached', async () => {
  const cases = [
    { label: 'public', isPrivateFile: false, filePath: `/contri-receipts/${ownTripId}/${expenseId}/public.jpg`, mime: 'image/jpeg', size: 1000, shouldDelete: true },
    { label: 'wrong folder', isPrivateFile: true, filePath: `/other/${ownTripId}/${expenseId}/file.jpg`, mime: 'image/jpeg', size: 1000, shouldDelete: false },
    { label: 'unsupported type', isPrivateFile: true, filePath: `/contri-receipts/${ownTripId}/${expenseId}/file.pdf`, mime: 'application/pdf', size: 1000, shouldDelete: true },
    { label: 'oversized', isPrivateFile: true, filePath: `/contri-receipts/${ownTripId}/${expenseId}/large.jpg`, mime: 'image/jpeg', size: 10 * 1024 * 1024 + 1, shouldDelete: true },
  ]
  for (const [index, invalid] of cases.entries()) {
    let deleted = false
    const fileId = `bad_receipt_${index}`
    const result = await invoke({
      handler: verifyHandler,
      token: creator.idToken,
      body: { tripId: ownTripId, expenseId, fileId },
      dependencies: {
        fetchImpl: withImageKitDetails({ fileId, ...invalid }, { onDelete: () => { deleted = true } }),
      },
    })
    assert.equal(result.statusCode, 400, invalid.label)
    assert.equal(deleted, invalid.shouldDelete, `${invalid.label} cleanup behavior`)
  }
})

test('non-creators cannot verify or retain an uploaded asset', async () => {
  let imageKitCalled = false
  const result = await invoke({
    handler: verifyHandler,
    token: member.idToken,
    body: { tripId: ownTripId, expenseId, fileId: 'unauthorized_upload' },
    dependencies: { fetchImpl: async (url, options) => {
      if (String(url).includes('imagekit.io')) imageKitCalled = true
      return fetch(url, options)
    } },
  })
  assert.equal(result.statusCode, 403)
  assert.equal(imageKitCalled, false)
})
