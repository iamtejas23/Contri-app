import { arrayUnion, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { buildMemberFromIdentity } from './utils.js'

export const addMemberToTrip = async ({ database, tripId, member }) => {
  const tripRef = doc(database, 'trips', tripId)
  let existingTrip

  try {
    const tripSnapshot = await getDoc(tripRef)
    if (!tripSnapshot.exists()) throw new Error('This trip could not be found. Check the invite link or trip ID.')
    existingTrip = tripSnapshot.data()
  } catch (error) {
    // Firestore intentionally hides trip documents from invitees until their join write succeeds.
    if (error?.code !== 'permission-denied') throw error
  }

  if (existingTrip) {
    const idListed = existingTrip.memberIds?.includes(member.uid)
    const memberListed = existingTrip.members?.some((tripMember) => tripMember.uid === member.uid)
    if (idListed && memberListed) return
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
  } catch (writeError) {
    // A concurrent session may have committed the same join first. Treat it as
    // success only after the server confirms both membership representations.
    try {
      const latestTrip = await getDoc(tripRef)
      const latestData = latestTrip.data()
      if (
        latestTrip.exists() &&
        latestData.memberIds?.includes(member.uid) &&
        latestData.members?.some((tripMember) => tripMember.uid === member.uid)
      ) return
    } catch {
      // Preserve the original write error when the confirmation read also fails.
    }
    throw writeError
  }
}
