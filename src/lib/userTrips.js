import { collection, getDocs, query, where } from 'firebase/firestore'

import { sortRecordsByDate } from './date.js'

export const tripsFromSnapshot = (snapshot) => snapshot.docs.map((item) => ({
  id: item.id,
  ...item.data(),
}))

export const getUserTripQueries = (database, uid) => ({
  memberships: query(collection(database, 'trips'), where('memberIds', 'array-contains', uid)),
  ownership: query(collection(database, 'trips'), where('createdBy', '==', uid)),
})

export const mergeUserTripSources = (sources) => {
  const uniqueTrips = new Map([
    ...(sources.memberships || []),
    ...(sources.ownership || []),
  ])
  return sortRecordsByDate([...uniqueTrips.values()], ['createdAt', 'updatedAt'])
}

export const loadUserTrips = async (database, uid) => {
  if (!uid) return []
  const queries = getUserTripQueries(database, uid)
  const [memberships, ownership] = await Promise.all([
    getDocs(queries.memberships),
    getDocs(queries.ownership),
  ])
  return mergeUserTripSources({
    memberships: tripsFromSnapshot(memberships).map((trip) => [trip.id, trip]),
    ownership: tripsFromSnapshot(ownership).map((trip) => [trip.id, trip]),
  })
}
