import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { buildMemberFromIdentity } from '../lib/utils.js'

const deleteCollectionDocs = async (database, collectionRef) => {
  const snapshot = await getDocs(collectionRef)
  const batchLimit = 450

  for (let start = 0; start < snapshot.docs.length; start += batchLimit) {
    const batch = writeBatch(database)
    snapshot.docs.slice(start, start + batchLimit).forEach((item) => batch.delete(item.ref))
    await batch.commit()
  }
}

export const createTripDocument = async ({ database, values, actor }) => {
  const adminMember = buildMemberFromIdentity(actor, 'admin')

  const tripRef = await addDoc(collection(database, 'trips'), {
    ...values,
    createdBy: actor.uid,
    members: [adminMember],
    memberIds: [actor.uid],
    adminIds: [actor.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return tripRef.id
}

export const deleteTripDocuments = async ({ database, tripId }) => {
  await deleteCollectionDocs(database, collection(database, 'trips', tripId, 'expenses'))
  await deleteCollectionDocs(database, collection(database, 'trips', tripId, 'settlements'))
  await deleteCollectionDocs(database, collection(database, 'trips', tripId, 'activity'))
  await deleteDoc(doc(database, 'trips', tripId))
}
