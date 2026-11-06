import process from 'node:process'
import { Buffer } from 'node:buffer'

const PROJECT_ID = () => process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT
const API_KEY = () => process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY

const readFirebaseTokenClaims = (idToken) => {
  const parts = String(idToken || '').split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

const firebaseHost = (emulatorHost, productionHost) => {
  const value = process.env[emulatorHost]
  if (!value) return productionHost
  return `http://${value.replace(/^https?:\/\//, '')}`
}

export const decodeFirestoreValue = (value) => {
  if (!value || typeof value !== 'object') return undefined
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return value.timestampValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue)
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {})
  return undefined
}

export const decodeFirestoreFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]),
)

const encodeFirestoreValue = (value) => {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } }
  return { mapValue: { fields: encodeFirestoreFields(value || {}) } }
}

export const encodeFirestoreFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, encodeFirestoreValue(value)]),
)

export const getBearerToken = (req) => {
  const value = req.headers?.authorization || req.headers?.Authorization || ''
  if (!value) throw Object.assign(new Error('The receipt request is missing authentication.'), { statusCode: 401, code: 'AUTH_MISSING' })
  const match = /^Bearer\s+(.+)$/i.exec(value)
  const token = match?.[1]?.trim()
  if (!token || /\s/.test(token)) {
    throw Object.assign(new Error('The receipt request has an invalid authentication header.'), { statusCode: 401, code: 'AUTH_MALFORMED' })
  }
  return token
}

export const verifyFirebaseIdentity = async (idToken, fetchImpl = fetch) => {
  const projectId = PROJECT_ID()
  const apiKey = API_KEY()
  if (!projectId || !apiKey) throw Object.assign(new Error('Receipt authentication is not configured on the server.'), { statusCode: 503, code: 'FIREBASE_CONFIG_ERROR' })
  const claims = readFirebaseTokenClaims(idToken)
  if (!claims?.sub || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw Object.assign(new Error('The Firebase session does not match this app project.'), { statusCode: 401, code: 'FIREBASE_PROJECT_MISMATCH' })
  }
  const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const base = firebaseHost('FIREBASE_AUTH_EMULATOR_HOST', 'https://identitytoolkit.googleapis.com')
  let response
  try {
    // Production host already includes identitytoolkit.googleapis.com. The duplicate
    // hostname in the old path caused Identity Toolkit lookups to fail on Vercel.
    const endpointPath = authEmulator ? '/identitytoolkit.googleapis.com/v1/accounts:lookup' : '/v1/accounts:lookup'
    response = await fetchImpl(`${base}${endpointPath}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
  } catch {
    throw Object.assign(new Error('Firebase verification is temporarily unavailable.'), { statusCode: 503, code: 'FIREBASE_VERIFY_UNAVAILABLE' })
  }
  if (!response.ok) {
    let payload = {}
    try { payload = await response.json() } catch { /* safely classify by HTTP status below */ }
    const reason = String(payload.error?.message || '').toUpperCase()
    if (['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'PROJECT_NOT_FOUND', 'INVALID_PROJECT_ID'].includes(reason)) {
      throw Object.assign(new Error('Receipt authentication is misconfigured on the server.'), { statusCode: 503, code: 'FIREBASE_CONFIG_ERROR', diagnosticCategory: reason })
    }
    if (['INVALID_ID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND', 'USER_DISABLED', 'INVALID_LOGIN_CREDENTIALS'].includes(reason)) {
      const expired = reason === 'TOKEN_EXPIRED'
      throw Object.assign(new Error(expired ? 'The Firebase ID token expired.' : 'Firebase rejected the ID token.'), {
        statusCode: 401,
        code: expired ? 'FIREBASE_TOKEN_EXPIRED' : 'FIREBASE_TOKEN_INVALID',
        diagnosticCategory: reason,
      })
    }
    if (response.status >= 500) {
      throw Object.assign(new Error('Firebase verification is temporarily unavailable.'), { statusCode: 503, code: 'FIREBASE_VERIFY_UNAVAILABLE', diagnosticCategory: `HTTP_${response.status}` })
    }
    throw Object.assign(new Error('Firebase could not verify this ID token.'), {
      statusCode: 401,
      code: 'FIREBASE_VERIFICATION_REJECTED',
      diagnosticCategory: `HTTP_${response.status}`,
    })
  }
  const payload = await response.json()
  const user = payload.users?.[0]
  if (!user?.localId || user.disabled || user.localId !== claims.sub) {
    throw Object.assign(new Error('Firebase rejected the authenticated account identity.'), { statusCode: 401, code: 'FIREBASE_TOKEN_INVALID' })
  }
  return {
    uid: user.localId,
    email: String(user.email || '').trim().toLowerCase(),
    emailVerified: user.emailVerified === true,
    // Identity Toolkit can omit providerUserInfo for anonymous users. The ID-token
    // claim is trustworthy here because accounts:lookup has just validated the
    // token and its UID against the returned account.
    isAnonymous: claims.firebase?.sign_in_provider
      ? claims.firebase.sign_in_provider === 'anonymous'
      : (user.providerUserInfo?.length === 0 && !user.email),
  }
}

export const getFirestoreDocument = async (path, idToken, fetchImpl = fetch) => {
  const projectId = PROJECT_ID()
  if (!projectId) throw Object.assign(new Error('Firebase project configuration is missing on the server.'), { statusCode: 503, code: 'FIREBASE_CONFIG_ERROR' })
  const host = firebaseHost('FIRESTORE_EMULATOR_HOST', 'https://firestore.googleapis.com')
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetchImpl(`${host}/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodedPath}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const statusCode = response.status === 403 ? 403 : response.status === 401 ? 401 : 502
    throw Object.assign(new Error(statusCode === 403
      ? 'You do not have access to this trip or expense.'
      : 'Trip data could not be verified right now.'), { statusCode, code: statusCode === 403 ? 'TRIP_AUTHORIZATION_FAILED' : 'FIRESTORE_LOOKUP_FAILED' })
  }
  const document = await response.json()
  return {
    name: document.name,
    updateTime: document.updateTime,
    createTime: document.createTime,
    ...decodeFirestoreFields(document.fields),
  }
}

export const assertCanViewReceipt = (trip, identity) => {
  const uid = identity?.uid
  const memberRecord = Array.isArray(trip?.members) ? trip.members.find((member) => member?.uid === uid) : null
  const isMember = Boolean(
    trip
    && uid
    && !identity.isAnonymous
    && !memberRecord?.isGuest
    && ((Array.isArray(trip.memberIds) && trip.memberIds.includes(uid)) || trip.createdBy === uid),
  )
  if (!isMember) {
    throw Object.assign(new Error('You must be a current trip member to view this receipt.'), { statusCode: 403, code: 'TRIP_AUTHORIZATION_FAILED' })
  }
  const isAdmin = trip.createdBy === uid
    || (Array.isArray(trip.memberIds) && trip.memberIds.includes(uid) && Array.isArray(trip.adminIds) && trip.adminIds.includes(uid))
  const viewers = Array.isArray(trip.receiptViewerIds) ? trip.receiptViewerIds : []
  // Upload permission is intentionally ignored. A missing viewer list denies members.
  if (!isAdmin && !viewers.includes(uid)) {
    throw Object.assign(new Error('Receipt viewing is not enabled for your account. Contact the trip admin.'), {
      statusCode: 403,
      code: 'RECEIPT_VIEW_DENIED',
    })
  }
}

export const assertTripMember = (trip, uid) => {
  const identity = typeof uid === 'object' ? uid : { uid }
  const fromIds = Array.isArray(trip?.memberIds) && trip.memberIds.includes(identity.uid)
  if (!trip || identity.isAnonymous || !(fromIds || trip.createdBy === identity.uid)) {
    throw Object.assign(new Error('You must be a current trip member to view this receipt.'), { statusCode: 403, code: 'TRIP_AUTHORIZATION_FAILED' })
  }
}

export const assertAuthorizedCreator = (trip, identity) => {
  if (identity.email !== 'tsmane8787@gmail.com' || !identity.emailVerified || !trip?.createdBy || trip.createdBy !== identity.uid) {
    throw Object.assign(new Error('Receipt uploads are only available to the verified trip creator account.'), { statusCode: 403, code: 'TRIP_AUTHORIZATION_FAILED' })
  }
}

export const assertCanUploadReceipt = (trip, identity) => {
  if (!trip) throw Object.assign(new Error('This trip could not be found.'), { statusCode: 404, code: 'TRIP_AUTHORIZATION_FAILED' })
  const isCurrentMember = (Array.isArray(trip.memberIds) && trip.memberIds.includes(identity.uid))
    || trip.createdBy === identity.uid
  if (identity.isAnonymous || !isCurrentMember) {
    throw Object.assign(new Error('Only current, non-guest trip members can upload receipts.'), { statusCode: 403, code: 'TRIP_AUTHORIZATION_FAILED' })
  }
  if (identity.uid === trip.createdBy && identity.email === 'tsmane8787@gmail.com' && identity.emailVerified) return
  // This optional flag is trusted only because Firestore rules permit changing it
  // exclusively to the verified authorized creator. Missing/legacy values fail closed.
  if (trip.allowMemberReceiptUploads !== true) {
    throw Object.assign(new Error('Receipt uploads are limited to the verified trip creator for this trip.'), { statusCode: 403, code: 'TRIP_AUTHORIZATION_FAILED' })
  }
}

export const assertTripAdmin = (trip, uid) => {
  const isMember = Array.isArray(trip?.memberIds) && trip.memberIds.includes(uid)
  const isAdmin = trip?.createdBy === uid || (isMember && Array.isArray(trip?.adminIds) && trip.adminIds.includes(uid))
  if (!isAdmin) throw Object.assign(new Error('Only a trip admin can remove a receipt.'), { statusCode: 403, code: 'TRIP_AUTHORIZATION_FAILED' })
}

export const validateDocumentId = (value, name) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(value)) {
    throw Object.assign(new Error(`A valid ${name} is required.`), { statusCode: 400 })
  }
  return value
}
