import {
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { db } from '../firebase/config.js'
import { notifyFirebaseError } from '../lib/errors.js'
import { addMemberToTrip } from '../lib/joinTrip.js'
import { buildMemberFromIdentity } from '../lib/utils.js'
import { createTripDocument, deleteTripDocuments } from './tripDocuments.js'

export { createTripDocument, deleteTripDocuments } from './tripDocuments.js'

export const createTrip = async ({ values, actor }) => {
  try {
    return await createTripDocument({ database: db, values, actor })
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
    await deleteTripDocuments({ database: db, tripId })
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
    await addMemberToTrip({ database: db, tripId, member })
  } catch (error) {
    notifyFirebaseError(error, 'We could not join that trip right now.')
    throw error
  }
}
