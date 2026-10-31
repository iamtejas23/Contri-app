import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'

import { buildMemberFromIdentity } from '../lib/utils.js'

export const syncTripMemberProfile = async ({ database, uid, name, photoURL = '', upiId }) => {
  if (!database || !uid) return

  const tripsSnapshot = await getDocs(
    query(collection(database, 'trips'), where('memberIds', 'array-contains', uid)),
  )

  await Promise.all(tripsSnapshot.docs.map(async (tripSnapshot) => {
    const currentMembers = tripSnapshot.data().members
    if (!Array.isArray(currentMembers)) return
    const currentMember = currentMembers.find((member) => member.uid === uid)
    if (!currentMember) return

    const safeName = name || currentMember.name || 'Traveler'
    const safeUpi = upiId === undefined ? currentMember.upiId || '' : upiId
    const currentPhoto = currentMember.photoURL || ''
    if (currentMember.name === safeName && (currentMember.upiId || '') === safeUpi && currentPhoto === photoURL) return

    const members = currentMembers.map((member) =>
      member.uid === uid
        ? buildMemberFromIdentity({
            ...member,
            uid,
            name: safeName,
            upiId: safeUpi,
            photoURL,
          }, member.role)
        : member,
    )

    await updateDoc(doc(database, 'trips', tripSnapshot.id), {
      members,
      updatedAt: serverTimestamp(),
    })
  }))
}
