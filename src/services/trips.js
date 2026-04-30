import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../firebase/config'
import { notifyFirebaseError } from '../lib/errors'
import { buildMemberFromIdentity, sanitizeFileName } from '../lib/utils'

const deleteCollectionDocs = async (collectionRef) => {
  const snapshot = await getDocs(collectionRef)

  if (snapshot.empty) {
    return
  }

  const batch = writeBatch(db)
  snapshot.docs.forEach((item) => batch.delete(item.ref))
  await batch.commit()
}

export const createTrip = async ({ values, actor }) => {
  try {
    const adminMember = buildMemberFromIdentity(actor, 'admin')

    const tripRef = await addDoc(collection(db, 'trips'), {
      ...values,
      createdBy: actor.uid,
      members: [adminMember],
      memberIds: [actor.uid],
      adminIds: [actor.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return tripRef.id
  } catch (error) {
    notifyFirebaseError(error, 'We could not create that trip.')
    throw error
  }
}

export const updateTrip = async (tripId, values) => {
  try {
    await updateDoc(doc(db, 'trips', tripId), {
      ...values,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not save those trip changes.')
    throw error
  }
}

export const deleteTrip = async (tripId) => {
  try {
    await deleteCollectionDocs(collection(db, 'trips', tripId, 'expenses'))
    await deleteCollectionDocs(collection(db, 'trips', tripId, 'settlements'))
    await deleteCollectionDocs(collection(db, 'trips', tripId, 'activity'))
    await deleteDoc(doc(db, 'trips', tripId))
  } catch (error) {
    notifyFirebaseError(error, 'We could not delete that trip.')
    throw error
  }
}

export const inviteMemberToTrip = async ({ tripId, member }) => {
  try {
    await updateDoc(doc(db, 'trips', tripId), {
      members: arrayUnion(buildMemberFromIdentity(member, 'member')),
      memberIds: arrayUnion(member.uid),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not add that member to the trip.')
    throw error
  }
}

export const updateTripMemberRole = async ({ tripId, members, memberId, role }) => {
  try {
    const nextMembers = members.map((member) =>
      member.uid === memberId ? { ...member, role } : member,
    )
    const nextAdminIds = nextMembers
      .filter((member) => member.role === 'admin')
      .map((member) => member.uid)

    await updateDoc(doc(db, 'trips', tripId), {
      members: nextMembers,
      adminIds: nextAdminIds,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not update that member role.')
    throw error
  }
}

export const joinTripByLink = async ({ tripId, member }) => {
  try {
    try {
      const tripSnapshot = await getDoc(doc(db, 'trips', tripId))

      if (tripSnapshot.exists() && tripSnapshot.data().memberIds?.includes(member.uid)) {
        return
      }
    } catch {
      // Non-members cannot read the trip before joining, so we fall through to the join update.
    }

    await updateDoc(doc(db, 'trips', tripId), {
      members: arrayUnion(buildMemberFromIdentity(member, 'member')),
      memberIds: arrayUnion(member.uid),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not join that trip right now.')
    throw error
  }
}

export const buildReceiptPath = ({ tripId, expenseId, fileName }) =>
  `receipts/${tripId}/${expenseId}-${Date.now()}-${sanitizeFileName(fileName)}`
