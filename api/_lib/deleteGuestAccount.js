import process from 'node:process'

import { firebaseHost, verifyFirebaseIdentity } from './firebase.js'

const projectId = () => process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT
const apiKey = () => process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY

const firestoreDocuments = () => {
  const id = projectId()
  if (!id) throw Object.assign(new Error('Firebase project configuration is missing on the server.'), { statusCode: 503, code: 'FIREBASE_CONFIG_ERROR' })
  return `${firebaseHost('FIRESTORE_EMULATOR_HOST', 'https://firestore.googleapis.com')}/v1/projects/${encodeURIComponent(id)}/databases/(default)/documents`
}

const authEndpoint = (method) => {
  const key = apiKey()
  if (!key) throw Object.assign(new Error('Guest account deletion is not configured on the server.'), { statusCode: 503, code: 'FIREBASE_CONFIG_ERROR' })
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const base = firebaseHost('FIREBASE_AUTH_EMULATOR_HOST', 'https://identitytoolkit.googleapis.com')
  const path = emulator ? `/identitytoolkit.googleapis.com/v1/accounts:${method}` : `/v1/accounts:${method}`
  return `${base}${path}?key=${encodeURIComponent(key)}`
}

const authorized = async (fetchImpl, url, idToken, options = {}) => {
  let response
  try {
    response = await fetchImpl(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    })
  } catch {
    throw Object.assign(new Error('Guest account cleanup could not reach Firebase. Check your connection and try again.'), {
      statusCode: 503,
      code: 'GUEST_CLEANUP_UNAVAILABLE',
      authDeleted: false,
    })
  }
  return response
}

const deleteDocument = async (fetchImpl, url, idToken) => {
  const response = await authorized(fetchImpl, url, idToken, { method: 'DELETE' })
  if (response.status === 404) return false
  if (!response.ok) {
    throw Object.assign(new Error('Personal guest data could not be removed. The account was not deleted.'), {
      statusCode: response.status === 403 ? 403 : 502,
      code: 'GUEST_CLEANUP_INCOMPLETE',
      authDeleted: false,
    })
  }
  return true
}

const listNotificationNames = async (fetchImpl, uid, idToken) => {
  const names = []
  let pageToken = ''
  do {
    const url = new URL(`${firestoreDocuments()}/users/${encodeURIComponent(uid)}/notifications`)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const response = await authorized(fetchImpl, url, idToken)
    if (response.status === 404) return names
    if (!response.ok) {
      throw Object.assign(new Error('Personal notifications could not be removed. The account was not deleted.'), {
        statusCode: response.status === 403 ? 403 : 502,
        code: 'GUEST_CLEANUP_INCOMPLETE',
        authDeleted: false,
      })
    }
    const payload = await response.json()
    names.push(...(payload.documents || []).map((document) => document.name))
    pageToken = payload.nextPageToken || ''
  } while (pageToken)
  return names
}

const deletePersonalGuestData = async ({ fetchImpl, uid, idToken }) => {
  const base = firestoreDocuments()
  const notificationNames = await listNotificationNames(fetchImpl, uid, idToken)
  let notificationsDeleted = 0
  for (const name of notificationNames) {
    const url = `${firebaseHost('FIRESTORE_EMULATOR_HOST', 'https://firestore.googleapis.com')}/v1/${name}`
    if (await deleteDocument(fetchImpl, url, idToken)) notificationsDeleted += 1
  }
  const profileDeleted = await deleteDocument(fetchImpl, `${base}/users/${encodeURIComponent(uid)}`, idToken)
  return { profileDeleted, notificationsDeleted }
}

const deleteAuthenticatedAccount = async ({ fetchImpl, idToken }) => {
  let response
  try {
    response = await fetchImpl(authEndpoint('delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
  } catch {
    throw Object.assign(new Error('The guest account could not be deleted. Personal cleanup may already be incomplete.'), {
      statusCode: 503,
      code: 'GUEST_AUTH_DELETE_FAILED',
      authDeleted: false,
    })
  }
  if (response.ok) return { authDeleted: true, alreadyDeleted: false }
  let payload = {}
  try { payload = await response.json() } catch { /* classify by status below */ }
  const reason = String(payload.error?.message || '').toUpperCase()
  if (reason === 'USER_NOT_FOUND') return { authDeleted: true, alreadyDeleted: true }
  if (['INVALID_ID_TOKEN', 'TOKEN_EXPIRED'].includes(reason)) {
    throw Object.assign(new Error(reason === 'TOKEN_EXPIRED'
      ? 'The Firebase session expired before the guest account could be deleted.'
      : 'Firebase rejected this session. Sign in again and retry.'), {
      statusCode: 401,
      code: reason === 'TOKEN_EXPIRED' ? 'FIREBASE_TOKEN_EXPIRED' : 'FIREBASE_TOKEN_INVALID',
      authDeleted: false,
    })
  }
  throw Object.assign(new Error('The guest account could not be deleted. Personal cleanup may already be incomplete.'), {
    statusCode: response.status >= 500 ? 503 : 502,
    code: 'GUEST_AUTH_DELETE_FAILED',
    authDeleted: false,
  })
}

// The UID always comes from the verified ID token. A client-supplied UID is ignored.
export const deleteCurrentGuestAccount = async ({ idToken, fetchImpl = fetch }) => {
  if (!idToken) {
    throw Object.assign(new Error('Sign in with the guest account before deleting it.'), { statusCode: 401, code: 'AUTH_MISSING', authDeleted: false })
  }
  const identity = await verifyFirebaseIdentity(idToken, fetchImpl)
  if (!identity.isAnonymous) {
    throw Object.assign(new Error('Only a guest account can be deleted this way.'), { statusCode: 403, code: 'GUEST_DELETION_FORBIDDEN', authDeleted: false })
  }
  const cleanup = await deletePersonalGuestData({ fetchImpl, uid: identity.uid, idToken })
  const authDeletion = await deleteAuthenticatedAccount({ fetchImpl, idToken })
  if (authDeletion.authDeleted !== true) {
    throw Object.assign(new Error('The guest account could not be deleted.'), { statusCode: 502, code: 'GUEST_AUTH_DELETE_FAILED', authDeleted: false, cleanup })
  }
  return {
    uid: identity.uid,
    authDeleted: true,
    alreadyDeleted: authDeletion.alreadyDeleted === true,
    cleanup,
  }
}
