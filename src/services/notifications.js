import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../firebase/config'

export const markNotificationRead = async ({ uid, notificationId }) => {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true })
}
