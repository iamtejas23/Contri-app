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
  const match = /^Bearer\s+(.+)$/i.exec(value)
  if (!match) throw Object.assign(new Error('Sign in to continue.'), { statusCode: 401 })
  return match[1].trim()
}

export const verifyFirebaseIdentity = async (idToken, fetchImpl = fetch) => {
  const projectId = PROJECT_ID()
  const apiKey = API_KEY()
  if (!projectId || !apiKey) throw Object.assign(new Error('Firebase project or API configuration is missing on the server.'), { statusCode: 503 })
  const claims = readFirebaseTokenClaims(idToken)
  if (!claims?.sub || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw Object.assign(new Error('This Firebase session belongs to a different or invalid project. Refresh the app session and retry.'), { statusCode: 401 })
  }
  const base = firebaseHost('FIREBASE_AUTH_EMULATOR_HOST', 'https://identitytoolkit.googleapis.com')
  const response = await fetchImpl(`${base}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const reason = String(payload.error?.message || '').toUpperCase()
    if (['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'PROJECT_NOT_FOUND'].includes(reason)) {
      throw Object.assign(new Error('Receipt authentication is misconfigured on the server. Contact the app administrator.'), { statusCode: 503 })
    }
    if (['INVALID_ID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND', 'USER_DISABLED', 'INVALID_LOGIN_CREDENTIALS'].includes(reason)) {
      throw Object.assign(new Error('Firebase rejected the ID token. Refresh the app session and retry.'), { statusCode: 401 })
    }
    throw Object.assign(new Error('Firebase could not verify this session right now. Retry the receipt request.'), { statusCode: response.status >= 500 ? 503 : 401 })
  }
  const payload = await response.json()
  const user = payload.users?.[0]
  if (!user?.localId || user.disabled) throw Object.assign(new Error('Your session is no longer valid.'), { statusCode: 401 })
  return {
    uid: user.localId,
    email: String(user.email || '').trim().toLowerCase(),
    emailVerified: user.emailVerified === true,
    isAnonymous: user.providerUserInfo?.length === 0 && !user.email,
  }
}

export const getFirestoreDocument = async (path, idToken, fetchImpl = fetch) => {
  const projectId = PROJECT_ID()
  if (!projectId) throw Object.assign(new Error('Firebase project configuration is missing on the server.'), { statusCode: 503 })
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
      : 'Trip data could not be verified right now.'), { statusCode })
  }
  const document = await response.json()
  return {
    name: document.name,
    updateTime: document.updateTime,
    createTime: document.createTime,
    ...decodeFirestoreFields(document.fields),
  }
}

export const assertTripMember = (trip, uid) => {
  const fromIds = Array.isArray(trip?.memberIds) && trip.memberIds.includes(uid)
  if (!trip || !(fromIds || trip.createdBy === uid)) {
    throw Object.assign(new Error('You must be a current trip member to view this receipt.'), { statusCode: 403 })
  }
}

export const assertAuthorizedCreator = (trip, identity) => {
  if (identity.email !== 'tsmane8787@gmail.com' || !identity.emailVerified || !trip?.createdBy || trip.createdBy !== identity.uid) {
    throw Object.assign(new Error('Receipt uploads are only available to the verified trip creator account.'), { statusCode: 403 })
  }
}

export const assertTripAdmin = (trip, uid) => {
  const isMember = Array.isArray(trip?.memberIds) && trip.memberIds.includes(uid)
  const isAdmin = trip?.createdBy === uid || (isMember && Array.isArray(trip?.adminIds) && trip.adminIds.includes(uid))
  if (!isAdmin) throw Object.assign(new Error('Only a trip admin can remove a receipt.'), { statusCode: 403 })
}

export const validateDocumentId = (value, name) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(value)) {
    throw Object.assign(new Error(`A valid ${name} is required.`), { statusCode: 400 })
  }
  return value
}
