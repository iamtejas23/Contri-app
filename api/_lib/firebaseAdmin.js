import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

let cachedServices

const readServiceAccount = () => {
  const projectId = globalThis.process?.env?.FIREBASE_PROJECT_ID
  const raw = globalThis.process?.env?.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!projectId || !raw) {
    throw Object.assign(new Error('Push delivery is not configured on the server.'), {
      statusCode: 503,
      code: 'PUSH_SERVER_CONFIG_MISSING',
    })
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(raw)
  } catch {
    throw Object.assign(new Error('Push delivery credentials are invalid.'), {
      statusCode: 503,
      code: 'PUSH_SERVER_CONFIG_INVALID',
    })
  }

  if (serviceAccount.project_id !== projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw Object.assign(new Error('Push delivery credentials do not match the configured Firebase project.'), {
      statusCode: 503,
      code: 'PUSH_PROJECT_CONFIG_MISMATCH',
    })
  }
  return { projectId, serviceAccount: { ...serviceAccount, private_key: serviceAccount.private_key.replaceAll('\\n', '\n') } }
}

export const getFirebaseAdminServices = () => {
  if (cachedServices) return cachedServices
  const { projectId, serviceAccount } = readServiceAccount()
  const app = getApps().find((item) => item.name === 'contri-push') || initializeApp({
    credential: cert(serviceAccount),
    projectId,
  }, 'contri-push')
  cachedServices = {
    auth: getAuth(app),
    firestore: getFirestore(app),
    messaging: getMessaging(app),
    FieldValue,
    projectId,
  }
  return cachedServices
}
