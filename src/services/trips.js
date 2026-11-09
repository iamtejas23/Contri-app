import {
  arrayUnion,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { auth, db } from '../firebase/config.js'
import { createActivityPayload } from '../lib/activity.js'
import { notifyFirebaseError } from '../lib/errors.js'
import { addMemberToTrip } from '../lib/joinTrip.js'
import { buildMemberFromIdentity } from '../lib/utils.js'
import { createTripDocument, deleteTripDocuments } from './tripDocuments.js'
import { requestPushDelivery } from './pushDelivery.js'

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

export const updateReceiptUploadPermission = async (tripId, enabled) => {
  await updateDoc(doc(db, 'trips', tripId), {
    allowMemberReceiptUploads: enabled === true,
    updatedAt: serverTimestamp(),
  })
}

export const updateReceiptViewPermission = async ({ tripId, memberUid, enabled, actorUid }) => {
  if (!tripId || !memberUid || !actorUid || typeof enabled !== 'boolean') {
    throw new Error('A trip, current admin, member and permission value are required.')
  }
  try {
    await runTransaction(db, async (transaction) => {
      const tripRef = doc(db, 'trips', tripId)
      const snapshot = await transaction.get(tripRef)
      if (!snapshot.exists()) throw new Error('Trip not found.')
      const trip = snapshot.data()
      const isAdmin = trip.createdBy === actorUid
        || (trip.memberIds?.includes(actorUid) && trip.adminIds?.includes(actorUid))
      if (!isAdmin) throw new Error('Only a trip admin can change receipt viewing permissions.')
      if (!trip.memberIds?.includes(memberUid)) throw new Error('Receipt viewing can only be granted to a current trip member.')
      if (memberUid === trip.createdBy || trip.adminIds?.includes(memberUid)) {
        throw new Error('Trip admins already can view receipts.')
      }

      const current = (Array.isArray(trip.receiptViewerIds) ? trip.receiptViewerIds : [])
        .filter((uid) => trip.memberIds.includes(uid))
      const next = enabled
        ? [...new Set([...current, memberUid])]
        : current.filter((uid) => uid !== memberUid)
      transaction.update(tripRef, {
        receiptViewerIds: next,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not update receipt viewing permissions.')
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
    const actor = auth.currentUser
    if (!actor?.uid || actor.isAnonymous) throw new Error('A signed-in trip admin is required to add a member.')
    const tripRef = doc(db, 'trips', tripId)
    const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
    const added = await runTransaction(db, async (transaction) => {
      const tripSnapshot = await transaction.get(tripRef)
      if (!tripSnapshot.exists()) throw new Error('Trip not found.')
      const trip = tripSnapshot.data()
      const currentMembers = new Set([
        ...(Array.isArray(trip.memberIds) ? trip.memberIds : []),
        ...(Array.isArray(trip.members) ? trip.members.map((entry) => entry.uid) : []),
      ])
      if (currentMembers.has(member.uid)) return false
      transaction.update(tripRef, {
        members: arrayUnion(buildMemberFromIdentity(member, 'member')),
        memberIds: arrayUnion(member.uid),
        updatedAt: serverTimestamp(),
      })
      transaction.set(activityRef, createActivityPayload({
        type: 'trip_member_added',
        actor: { uid: actor.uid, name: actor.displayName || 'A trip admin', email: actor.email || '' },
        message: '{actor} added a member to the trip.',
        meta: { targetUid: member.uid },
      }))
      return true
    })
    if (added) void requestPushDelivery({ tripId, eventId: activityRef.id, eventType: 'trip_member_added' })
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
