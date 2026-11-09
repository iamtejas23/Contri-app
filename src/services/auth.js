import {
  signInWithCredential,
  signInAnonymously,
  signInWithPopup,
  linkWithCredential,
  linkWithPopup,
  GoogleAuthProvider,
  reload,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { removeOwnPushToken } from './pushNotifications.js'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'

import { auth, db, googleProvider } from '../firebase/config'
import { notifyFirebaseError } from '../lib/errors'
import { createGuestSession } from '../lib/guestAuth'
import { getDisplayName } from '../lib/utils'
import { getGooglePhotoURL, hasGoogleProvider } from '../lib/googleProfile.js'
import { syncTripMemberProfile } from './memberProfiles.js'

const ensureUserProfileOnce = async (user) => {
  const userRef = doc(db, 'users', user.uid)

  try {
    const isGoogleUser = hasGoogleProvider(user)
    let profileUser = user
    let refreshedGoogleProfile = false

    // Firebase persists the last-known photo on User. Refresh it first so an
    // account photo changed at Google is not propagated from stale Auth state.
    if (isGoogleUser) {
      try {
        await reload(user)
        profileUser = auth.currentUser?.uid === user.uid ? auth.currentUser : user
        refreshedGoogleProfile = true
      } catch {
        // Keep sign-in usable offline; avoid propagating a potentially stale
        // cached Google photo when the provider refresh could not complete.
      }
    }

    const snapshot = await getDoc(userRef)
    const googlePhotoURL = isGoogleUser ? getGooglePhotoURL(profileUser) : ''
    const trustedGooglePhotoURL = refreshedGoogleProfile ? googlePhotoURL : ''
    const displayName = profileUser.displayName || snapshot.data()?.name || getDisplayName(profileUser)

    if (!snapshot.exists()) {
      // Wait for the guest to choose a name before creating their profile.
      if (profileUser.isAnonymous && !profileUser.displayName) return
      await setDoc(userRef, {
        name: displayName,
        email: profileUser.email?.toLowerCase() || '',
        photoURL: googlePhotoURL || profileUser.photoURL || '',
        ...(profileUser.isAnonymous ? { isGuest: true } : {}),
        createdAt: serverTimestamp(),
      }, { merge: true })
    } else {
      const currentProfile = snapshot.data()
      await updateDoc(userRef, {
        name: displayName,
        email: profileUser.email?.toLowerCase() || '',
        ...(trustedGooglePhotoURL ? { photoURL: trustedGooglePhotoURL } : {}),
        ...(profileUser.isAnonymous || currentProfile.isGuest
          ? { isGuest: Boolean(profileUser.isAnonymous) }
          : {}),
      })
    }

    // Sync only this authenticated user's embedded member entries. The query
    // is scoped by memberIds and the Firestore rule permits changing only the
    // caller's own member profile fields. No profile scan or other-user write.
    if (isGoogleUser && refreshedGoogleProfile) {
      try {
        await syncTripMemberProfile({
          database: db,
          uid: user.uid,
          name: displayName,
          photoURL: googlePhotoURL,
          upiId: snapshot.data()?.upiId || '',
        })
      } catch (syncError) {
        notifyFirebaseError(syncError, 'Your Google photo is saved, but some trip member photos could not be refreshed.')
      }
    }
  } catch (error) {
    notifyFirebaseError(error, 'We could not sync your profile right now.')
    throw error
  }
}

const profileSyncs = new Map()
export const ensureUserProfile = (user) => {
  if (!user?.uid) return Promise.resolve()
  const existing = profileSyncs.get(user.uid)
  if (existing) return existing

  const pending = ensureUserProfileOnce(user).finally(() => {
    if (profileSyncs.get(user.uid) === pending) profileSyncs.delete(user.uid)
  })
  profileSyncs.set(user.uid, pending)
  return pending
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
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      await removeOwnPushToken(auth.currentUser.uid, { forgetPreference: true })
    }
    await signOut(auth)
  } catch (error) {
    notifyFirebaseError(error, 'We could not safely remove this device from push notifications. Check your connection and try signing out again.')
    throw error
  }
}
