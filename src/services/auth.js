import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

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

export const registerWithEmail = async ({ name, email, password }) => {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName: name })
    await ensureUserProfile({ ...credential.user, displayName: name })
    return credential.user
  } catch (error) {
    notifyFirebaseError(error, 'We could not create your account.')
    throw error
  }
}

export const loginWithEmail = async ({ email, password }) => {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    await ensureUserProfile(credential.user)
    return credential.user
  } catch (error) {
    notifyFirebaseError(error, 'We could not sign you in.')
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

export const logoutUser = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    notifyFirebaseError(error, 'We could not sign you out.')
    throw error
  }
}
