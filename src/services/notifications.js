import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../firebase/config.js'
import {
  clearAllNotificationsFromDatabase,
  clearNotificationsForTripFromDatabase,
  getNotificationTrips as getNotificationTripsFromDatabase,
} from './notificationClearing.js'

export const markNotificationRead = async ({ uid, notificationId }) => {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true })
}

export const getNotificationTrips = ({ uid, database = db }) =>
  getNotificationTripsFromDatabase({ uid, database })

export const clearAllNotifications = ({ uid, database = db }) =>
  clearAllNotificationsFromDatabase({ uid, database })

export const clearNotificationsForTrip = ({ uid, tripId, database = db }) =>
  clearNotificationsForTripFromDatabase({ uid, tripId, database })
