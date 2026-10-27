import {
  signInWithCredential,
  signInAnonymously,
  signInWithPopup,
  linkWithCredential,
  linkWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'

import { auth, db, googleProvider } from '../firebase/config'
import { notifyFirebaseError } from '../lib/errors'
import { createGuestSession } from '../lib/guestAuth'
import { getDisplayName } from '../lib/utils'

export const ensureUserProfile = async (user) => {
  const userRef = doc(db, 'users', user.uid)

  try {
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      // Wait for the guest to choose a name before creating their profile.
      if (user.isAnonymous && !user.displayName) return
      await setDoc(userRef, {
        name: getDisplayName(user),
        email: user.email?.toLowerCase() || '',
        photoURL: user.photoURL || '',
        ...(user.isAnonymous ? { isGuest: true } : {}),
        createdAt: serverTimestamp(),
      }, { merge: true })
      return
    }

    await updateDoc(userRef, {
      name: user.displayName || snapshot.data().name || getDisplayName(user),
      email: user.email?.toLowerCase() || '',
      photoURL: user.photoURL || '',
      ...(user.isAnonymous || snapshot.data().isGuest
        ? { isGuest: Boolean(user.isAnonymous) }
        : {}),
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not sync your profile right now.')
    throw error
  }
}

export const loginWithGoogle = async () => {
  try {
    const credential = auth.currentUser?.isAnonymous
      ? await linkWithPopup(auth.currentUser, googleProvider)
      : await signInWithPopup(auth, googleProvider)
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
    const userCredential = auth.currentUser?.isAnonymous
      ? await linkWithCredential(auth.currentUser, credential)
      : await signInWithCredential(auth, credential)
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

export const createGuestAccount = async ({ name, contactEmail = '' }) => {
  try {
    return await createGuestSession({ auth, database: db, name, contactEmail })
  } catch (error) {
    notifyFirebaseError(error, 'Guest account could not be created. Check your connection and try again.')
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
