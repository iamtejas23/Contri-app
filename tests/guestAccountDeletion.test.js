import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import test from 'node:test'

import handler from '../api/auth/delete-guest.js'
import { encodeFirestoreFields } from '../api/_lib/firebase.js'
import {
  canRequestGuestDeletion,
  completeGuestDeletionSession,
  deleteCurrentGuestAccount,
  guestDeletionConfirmationMatches,
} from '../src/lib/guestAccountDeletion.js'

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-contri-notifications'
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const authBase = `http://${authHost.replace(/^https?:\/\//, '')}/identitytoolkit.googleapis.com/v1`
const firestoreBase = `http://${firestoreHost.replace(/^https?:\/\//, '')}/v1/projects/${projectId}/databases/(default)/documents`

process.env.FIREBASE_PROJECT_ID = projectId
process.env.FIREBASE_WEB_API_KEY = 'emulator-test-key'

const requestJson = async (url, { method = 'POST', body, token, admin = false } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: 'Bearer owner' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

const makeAnonymousUser = async () => {
  const { response, payload } = await requestJson(`${authBase}/accounts:signUp?key=emulator-test-key`, {
    body: { returnSecureToken: true },
  })
  assert.equal(response.status, 200, JSON.stringify(payload))
  return payload
}

const makeUser = async (email) => {
  const { response, payload } = await requestJson(`${authBase}/accounts:signUp?key=emulator-test-key`, {
    body: { email, password: 'guest-delete-password', returnSecureToken: true },
  })
  assert.equal(response.status, 200, JSON.stringify(payload))
  return payload
}

const seed = async (path, fields) => {
  const { response, payload } = await requestJson(`${firestoreBase}/${path}`, {
    method: 'PATCH', admin: true, body: { fields: encodeFirestoreFields(fields) },
  })
  assert.ok(response.ok, JSON.stringify(payload))
}

const read = async (path) => requestJson(`${firestoreBase}/${path}`, { method: 'GET', admin: true })

const invoke = async ({ token, body = {}, fetchImpl } = {}) => {
  const req = { method: 'POST', headers: { authorization: token ? `Bearer ${token}` : '' }, body }
  const result = { statusCode: 200, body: null }
  const res = {
    setHeader() {},
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
    end() { return this },
  }
  await handler(req, res, fetchImpl ? { fetchImpl } : {})
  return result
}

test('confirmation and guest eligibility do not trust a profile flag', () => {
  assert.equal(guestDeletionConfirmationMatches('DELETE'), true)
  assert.equal(guestDeletionConfirmationMatches('delete'), false)
  assert.equal(canRequestGuestDeletion({ uid: 'guest', isAnonymous: true }), true)
  assert.equal(canRequestGuestDeletion({ uid: 'member', isAnonymous: false, isGuest: true }), false)
  assert.equal(canRequestGuestDeletion(null), false)
})

test('a failed or incomplete deletion does not clear the session', async () => {
  let navigated = false
  let cleared = false
  await assert.rejects(() => completeGuestDeletionSession({
    result: { authDeleted: false },
    signOutImpl: async () => { throw new Error('should not sign out') },
    clearLocalSession: () => { cleared = true },
    navigate: () => { navigated = true },
  }), /not deleted/)
  assert.equal(navigated, false)
  assert.equal(cleared, false)
})

test('duplicate guest deletion requests share one in-flight call', async () => {
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const user = { uid: 'guest-lock', isAnonymous: true, getIdToken: async () => 'token' }
  const fetchImpl = async () => {
    calls += 1
    await gate
    return new Response(JSON.stringify({ authDeleted: true, uid: 'guest-lock' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const first = deleteCurrentGuestAccount({ user, fetchImpl })
  const second = deleteCurrentGuestAccount({ user, fetchImpl })
  release()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a, b)
  assert.equal(calls, 1)
})

test('successful deletion clears the local session and opens the login screen', async () => {
  const events = []
  await completeGuestDeletionSession({
    result: { authDeleted: true },
    signOutImpl: async () => { events.push('sign-out') },
    clearLocalSession: () => { events.push('clear') },
    navigate: (path, options) => { events.push(`${path}:${options.replace}`) },
  })
  assert.deepEqual(events, ['clear', 'sign-out', '/login:true'])
})

test('anonymous guest deletion removes only that account and leaves shared records untouched', async () => {
  const guest = await makeAnonymousUser()
  const other = await makeUser(`kept-${randomUUID()}@example.test`)
  const tripId = `guest-trip-${randomUUID().replaceAll('-', '')}`
  const expense = {
    title: 'Shared dinner',
    amount: 80,
    receiptURL: 'https://ik.imagekit.io/legacy/receipt.jpg',
    receiptFiles: { file: { provider: 'supabase', bucket: 'contri-receipts', fileId: 'file', path: `trips/${tripId}/expenses/expense-1/file.jpg` } },
  }
  const settlement = { from: other.localId, to: guest.localId, amount: 20, method: 'upi' }
  await seed(`users/${guest.localId}`, { name: 'Guest', isGuest: true, contactEmail: 'guest@example.test' })
  await seed(`users/${guest.localId}/notifications/note-1`, { tripId, read: false })
  await seed(`users/${other.localId}`, { name: 'Kept member' })
  await seed(`users/${other.localId}/notifications/kept-note`, { tripId, read: false })
  await seed(`trips/${tripId}`, { createdBy: guest.localId, memberIds: [guest.localId, other.localId], adminIds: [guest.localId], name: 'Guest created trip' })
  await seed(`trips/${tripId}/expenses/expense-1`, expense)
  await seed(`trips/${tripId}/settlements/settlement-1`, settlement)

  const urls = []
  const result = await invoke({
    token: guest.idToken,
    body: { uid: other.localId },
    fetchImpl: async (url, options) => {
      urls.push(String(url))
      return fetch(url, options)
    },
  })

  assert.equal(result.statusCode, 200, JSON.stringify(result.body))
  assert.equal(result.body.authDeleted, true)
  assert.equal(result.body.uid, guest.localId)
  assert.equal(result.body.uid === other.localId, false)
  assert.equal(urls.some((url) => url.includes('/trips/') || url.includes('supabase')), false)

  const guestProfile = await read(`users/${guest.localId}`)
  const guestNote = await read(`users/${guest.localId}/notifications/note-1`)
  const keptProfile = await read(`users/${other.localId}`)
  const keptNote = await read(`users/${other.localId}/notifications/kept-note`)
  const trip = await read(`trips/${tripId}`)
  const savedExpense = await read(`trips/${tripId}/expenses/expense-1`)
  const savedSettlement = await read(`trips/${tripId}/settlements/settlement-1`)
  assert.equal(guestProfile.response.status, 404)
  assert.equal(guestNote.response.status, 404)
  assert.equal(keptProfile.payload.fields.name.stringValue, 'Kept member')
  assert.equal(keptNote.payload.fields.tripId.stringValue, tripId)
  assert.equal(trip.payload.fields.createdBy.stringValue, guest.localId)
  assert.equal(trip.payload.fields.name.stringValue, 'Guest created trip')
  assert.equal(savedExpense.payload.fields.title.stringValue, 'Shared dinner')
  assert.equal(savedExpense.payload.fields.amount.integerValue || savedExpense.payload.fields.amount.doubleValue, '80')
  assert.equal(savedExpense.payload.fields.receiptURL.stringValue, expense.receiptURL)
  assert.equal(savedExpense.payload.fields.receiptFiles.mapValue.fields.file.mapValue.fields.bucket.stringValue, 'contri-receipts')
  assert.equal(savedSettlement.payload.fields.amount.integerValue || savedSettlement.payload.fields.amount.doubleValue, '20')
})

test('a regular account cannot use guest deletion and a failed auth delete is not success', async () => {
  const member = await makeUser(`member-${randomUUID()}@example.test`)
  const guest = await makeAnonymousUser()
  await seed(`users/${member.localId}`, { name: 'Member' })
  await seed(`users/${guest.localId}`, { name: 'Guest retry' })
  const denied = await invoke({ token: member.idToken, body: { uid: guest.localId } })
  assert.equal(denied.statusCode, 403)
  assert.equal(denied.body.authDeleted, false)
  assert.equal(denied.body.code, 'GUEST_DELETION_FORBIDDEN')
  assert.equal((await read(`users/${member.localId}`)).payload.fields.name.stringValue, 'Member')
  assert.equal((await read(`users/${guest.localId}`)).payload.fields.name.stringValue, 'Guest retry')

  const failed = await invoke({
    token: guest.idToken,
    fetchImpl: async (url, options) => {
      if (String(url).includes('accounts:delete')) {
        return new Response(JSON.stringify({ error: { message: 'INTERNAL' } }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
      return fetch(url, options)
    },
  })
  assert.notEqual(failed.statusCode, 200)
  assert.equal(failed.body.authDeleted, false)
  assert.equal(failed.body.code, 'GUEST_AUTH_DELETE_FAILED')
  const stillGuest = await requestJson(`${authBase}/accounts:lookup?key=emulator-test-key`, {
    body: { idToken: guest.idToken },
  })
  assert.equal(stillGuest.response.status, 200)
  assert.equal(stillGuest.payload.users?.[0]?.localId, guest.localId)
})
