import { arrayUnion, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { logFirestoreOperationError } from './firestoreDiagnostics.js'
import { isExistingTripParticipant } from './joinInvitation.js'
import { buildMemberFromIdentity } from './utils.js'

export const addMemberToTrip = async ({ database, tripId, member }) => {
  const tripRef = doc(database, 'trips', tripId)
  let existingTrip

  try {
    const tripSnapshot = await getDoc(tripRef)
    if (!tripSnapshot.exists()) throw new Error('This trip could not be found. Check the invite link or trip ID.')
    existingTrip = tripSnapshot.data()
  } catch (error) {
    logFirestoreOperationError({
      operation: 'get',
      path: `trips/${tripId}`,
      code: error?.code,
    })
    // Firestore intentionally hides trip documents from invitees until their join write succeeds.
    if (error?.code !== 'permission-denied') throw error
  }

  if (existingTrip) {
    const idListed = existingTrip.memberIds?.includes(member.uid)
    const memberListed = existingTrip.members?.some((tripMember) => tripMember.uid === member.uid)
    // Trip creators already have access. Do not attempt a self-join write.
    if (existingTrip.createdBy === member.uid) return false
    if (idListed && memberListed) return false
    if (idListed || memberListed) {
      throw new Error('This trip has an incomplete member record. Ask a trip admin to review membership before trying again.')
    }
  }

  try {
    await updateDoc(tripRef, {
      members: arrayUnion(buildMemberFromIdentity(member, 'member')),
      memberIds: arrayUnion(member.uid),
      updatedAt: serverTimestamp(),
    })
    return true
  } catch (writeError) {
    logFirestoreOperationError({
      operation: 'update',
      path: `trips/${tripId}`,
      code: writeError?.code,
    })
    // A concurrent session may have committed the same join first. Treat it as
    // success only after the server confirms both membership representations.
    try {
      const latestTrip = await getDoc(tripRef)
      const latestData = latestTrip.data()
      if (
        latestTrip.exists()
        && isExistingTripParticipant(latestData, member.uid)
        && latestData.memberIds?.includes(member.uid)
        && latestData.members?.some((tripMember) => tripMember.uid === member.uid)
      ) return false
    } catch (confirmError) {
      logFirestoreOperationError({
        operation: 'get',
        path: `trips/${tripId}`,
        code: confirmError?.code,
      })
    }
    throw writeError
  }
}
