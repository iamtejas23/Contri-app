import { signOut } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'

import { auth, db } from '../firebase/config.js'
import { completeGuestDeletionSession as finishGuestDeletion } from '../lib/guestAccountDeletion.js'
import { clearPendingReceiptCapture } from './receiptCamera.js'

export {
  canRequestGuestDeletion,
  deleteCurrentGuestAccount,
  GUEST_DELETION_CONFIRMATION,
  guestDeletionConfirmationMatches,
} from '../lib/guestAccountDeletion.js'

export const loadGuestSharedTripSummary = async (uid) => {
  const [memberships, created] = await Promise.all([
    getDocs(query(collection(db, 'trips'), where('memberIds', 'array-contains', uid))),
    getDocs(query(collection(db, 'trips'), where('createdBy', '==', uid))),
  ])
  return {
    sharedTripCount: memberships.size,
    createdTripCount: created.size,
  }
}

export const completeGuestDeletionSession = (options) => finishGuestDeletion({
  signOutImpl: () => signOut(auth),
  clearLocalSession: clearPendingReceiptCapture,
  ...options,
})
