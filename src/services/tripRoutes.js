import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'

import { db } from '../firebase/config.js'
import { createEmptyTripRoute, validateTripRoute } from '../lib/tripRoute.js'

export const subscribeTripRoute = (tripId, onChange, onError) => (
  onSnapshot(doc(db, 'trips', tripId, 'route', 'current'), (snapshot) => {
    onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
  }, onError)
)

export const updateTripRoute = async ({ tripId, actorUid, transform }) => {
  if (!tripId || !actorUid || typeof transform !== 'function') throw new Error('Route update details are incomplete.')
  const routeRef = doc(db, 'trips', tripId, 'route', 'current')
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(routeRef)
    const current = snapshot.exists() ? snapshot.data() : createEmptyTripRoute(tripId)
    const next = transform(current)
    const errors = validateTripRoute(next)
    if (errors.length) throw new Error(errors[0])
    transaction.set(routeRef, {
      tripId,
      version: 1,
      start: next.start,
      stops: next.stops,
      destination: next.destination,
      updatedBy: actorUid,
      updatedAt: serverTimestamp(),
    })
    return next
  })
}
