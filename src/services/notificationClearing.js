import { collection, getDocs, writeBatch } from 'firebase/firestore'

const NOTIFICATION_DELETE_BATCH_SIZE = 450

export const getConfirmedNotificationClearAction = (dialog) => {
  if (dialog?.kind === 'all-confirm') return { type: 'all' }
  if (dialog?.kind === 'trip-confirm' && typeof dialog.trip?.tripId === 'string' && dialog.trip.tripId) {
    return { type: 'trip', tripId: dialog.trip.tripId }
  }
  return null
}

const getUserNotifications = async ({ uid, database }) => {
  if (typeof uid !== 'string' || !uid) throw new Error('A signed-in account is required.')
  const snapshot = await getDocs(collection(database, 'users', uid, 'notifications'))
  return snapshot.docs
}

const deleteNotificationDocuments = async ({ database, documents }) => {
  for (let index = 0; index < documents.length; index += NOTIFICATION_DELETE_BATCH_SIZE) {
    const batch = writeBatch(database)
    documents
      .slice(index, index + NOTIFICATION_DELETE_BATCH_SIZE)
      .forEach((notification) => batch.delete(notification.ref))
    await batch.commit()
  }
  return {
    deletedCount: documents.length,
    deletedUnreadCount: documents.filter((notification) => notification.data().read === false).length,
    notificationIds: documents.map((notification) => notification.id),
  }
}

export const getNotificationTrips = async ({ uid, database }) => {
  const documents = await getUserNotifications({ uid, database })
  const trips = new Map()

  documents.forEach((notification) => {
    const { tripId, tripName } = notification.data()
    // Legacy or malformed records without an explicit trip ID cannot be safely grouped.
    if (typeof tripId !== 'string' || !tripId) return
    const current = trips.get(tripId)
    trips.set(tripId, {
      tripId,
      tripName: current?.tripName || (typeof tripName === 'string' && tripName) || tripId,
      count: (current?.count || 0) + 1,
    })
  })

  return [...trips.values()].sort((left, right) => left.tripName.localeCompare(right.tripName))
}

export const clearAllNotificationsFromDatabase = async ({ uid, database }) => {
  const documents = await getUserNotifications({ uid, database })
  return deleteNotificationDocuments({ database, documents })
}

export const clearNotificationsForTripFromDatabase = async ({ uid, tripId, database }) => {
  if (typeof tripId !== 'string' || !tripId) throw new Error('Select a valid trip.')
  const documents = await getUserNotifications({ uid, database })
  const matchingDocuments = documents.filter((notification) => notification.data().tripId === tripId)
  return deleteNotificationDocuments({ database, documents: matchingDocuments })
}
