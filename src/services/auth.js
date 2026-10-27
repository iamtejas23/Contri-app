import {
  signInWithCredential,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'

import { auth, db, googleProvider } from '../firebase/config'
import { notifyFirebaseError } from '../lib/errors'
import { getDisplayName } from '../lib/utils'

export const ensureUserProfile = async (user) => {
  const userRef = doc(db, 'users', user.uid)

  try {
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      await setDoc(userRef, {
        name: getDisplayName(user),
        email: user.email?.toLowerCase() || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      })
      return
    }

    await updateDoc(userRef, {
      name: getDisplayName(user),
      email: user.email?.toLowerCase() || '',
      photoURL: user.photoURL || '',
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not sync your profile right now.')
    throw error
  }
}

export const loginWithGoogle = async () => {
  try {
    const credential = await signInWithPopup(auth, googleProvider)
    await ensureUserProfile(credential.user)
    return credential.user
  } catch (error) {
    notifyFirebaseError(error, 'Google sign-in did not finish.')
    throw error
  }
}

export const loginWithNativeGoogle = async () => {
  try {
    if (!Capacitor.isNativePlatform()) return loginWithGoogle()
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
    const idToken = result.credential?.idToken
    if (!idToken) throw new Error('Google did not return an ID token. Check the Android OAuth client and SHA fingerprints.')
    const credential = GoogleAuthProvider.credential(idToken)
    const userCredential = await signInWithCredential(auth, credential)
    await ensureUserProfile(userCredential.user)
    return userCredential.user
  } catch (error) {
    notifyFirebaseError(error, 'Google sign-in could not be completed.')
    throw error
  }
}

export const continueAsGuest = async () => {
  try {
    const credential = auth.currentUser
      ? { user: auth.currentUser }
      : await signInAnonymously(auth)
    const guestName = `Guest ${credential.user.uid.slice(0, 4)}`
    if (!credential.user.displayName) {
      await updateProfile(credential.user, { displayName: guestName })
    }
    await ensureUserProfile({ ...credential.user, displayName: credential.user.displayName || guestName })
    return credential.user
  } catch (error) {
    notifyFirebaseError(error, 'Guest access is unavailable. Try again or sign in.')
    throw error
  }
}

export const logoutUser = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    notifyFirebaseError(error, 'We could not sign you out.')
    throw error
  }
}
