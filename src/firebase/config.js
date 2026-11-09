import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { getFirestore } from 'firebase/firestore'

import { resolveFirebaseAuthDomain } from '../lib/firebaseAuthDomain.js'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveFirebaseAuthDomain(projectId, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)

export const analyticsPromise =
  typeof window !== 'undefined'
    ? import('firebase/analytics')
        .then(async ({ getAnalytics, isSupported }) =>
          ((await isSupported()) ? getAnalytics(app) : null),
        )
        .catch(() => null)
    : Promise.resolve(null)

export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({
  prompt: 'select_account',
})

export default app
