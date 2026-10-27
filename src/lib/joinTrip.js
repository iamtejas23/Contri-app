import { arrayUnion, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { buildMemberFromIdentity } from './utils.js'

export const addMemberToTrip = async ({ database, tripId, member }) => {
  const tripRef = doc(database, 'trips', tripId)

  try {
    const tripSnapshot = await getDoc(tripRef)
    if (tripSnapshot.exists() && tripSnapshot.data().memberIds?.includes(member.uid)) return
  } catch {
    // A valid invitee is not a member yet, so Firestore rules deny this read.
  }

  await updateDoc(tripRef, {
    members: arrayUnion(buildMemberFromIdentity(member, 'member')),
    memberIds: arrayUnion(member.uid),
    updatedAt: serverTimestamp(),
  })
}
