import { updateProfile } from 'firebase/auth'
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'

import { auth, db } from '../firebase/config'
import { notifyFirebaseError } from '../lib/errors'
import { syncTripMemberProfile } from './memberProfiles.js'

export const findUserByEmail = async (email) => {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase())),
    )

    if (snapshot.empty) {
      return null
    }

    const userDoc = snapshot.docs[0]
    return {
      uid: userDoc.id,
      ...userDoc.data(),
    }
  } catch (error) {
    notifyFirebaseError(error, 'We could not look up that user.')
    throw error
  }
}

export { syncTripMemberProfile } from './memberProfiles.js'

export const updateUserProfileDoc = async ({ uid, name, photoURL = '', upiId = '' }) => {
  try {
    const safeName = name.trim()
    const safeUpi = upiId.trim()
    await setDoc(
      doc(db, 'users', uid),
      {
        name: safeName,
        email: auth.currentUser?.email?.toLowerCase() || '',
        photoURL,
        upiId: safeUpi,
      },
      { merge: true },
    )

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: safeName,
        photoURL,
      })
    }

    await syncTripMemberProfile({ database: db, uid, name: safeName, photoURL, upiId: safeUpi })
  } catch (error) {
    notifyFirebaseError(error, 'We could not save your profile changes.')
    throw error
  }
}
