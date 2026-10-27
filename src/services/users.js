import { updateProfile } from 'firebase/auth'
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'

import { auth, db } from '../firebase/config'
import { notifyFirebaseError } from '../lib/errors'
import { buildMemberFromIdentity } from '../lib/utils'

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

    const tripsSnapshot = await getDocs(
      query(collection(db, 'trips'), where('memberIds', 'array-contains', uid)),
    )

    await Promise.all(
      tripsSnapshot.docs.map(async (tripDoc) => {
        const currentMembers = tripDoc.data().members
        const currentMember = currentMembers.find((member) => member.uid === uid)
        if (!currentMember || (currentMember.name === safeName && (currentMember.upiId || '') === safeUpi)) {
          return
        }

        const members = currentMembers.map((member) =>
          member.uid === uid
            ? buildMemberFromIdentity({ ...member, uid, name: safeName, upiId: safeUpi }, member.role)
            : member,
        )

        await updateDoc(doc(db, 'trips', tripDoc.id), {
          members,
          updatedAt: serverTimestamp(),
        })
      }),
    )
  } catch (error) {
    notifyFirebaseError(error, 'We could not save your profile changes.')
    throw error
  }
}
