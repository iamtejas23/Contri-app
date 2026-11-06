export const RECEIPT_VIEW_DENIED_MESSAGE = 'Receipt viewing is not enabled for your account. Contact the trip admin.'

export const getReceiptViewerIds = (trip) => {
  const memberIds = Array.isArray(trip?.memberIds) ? trip.memberIds : []
  const viewers = Array.isArray(trip?.receiptViewerIds) ? trip.receiptViewerIds : []
  return [...new Set(viewers.filter((uid) => memberIds.includes(uid)))]
}

const memberRecord = (trip, uid) => (
  Array.isArray(trip?.members) ? trip.members.find((member) => member?.uid === uid) : null
)

export const isActiveTripParticipant = (trip, identity) => {
  const uid = identity?.uid
  if (!trip || !uid) return false
  return trip.createdBy === uid || (Array.isArray(trip.memberIds) && trip.memberIds.includes(uid))
}

export const isCurrentTripMember = (trip, identity) => {
  const uid = identity?.uid
  if (!isActiveTripParticipant(trip, identity) || identity?.isAnonymous || memberRecord(trip, uid)?.isGuest) return false
  return true
}

export const isReceiptAdmin = (trip, identity) => {
  const uid = identity?.uid
  if (!isCurrentTripMember(trip, identity)) return false
  return trip.createdBy === uid
    || (Array.isArray(trip.adminIds) && trip.adminIds.includes(uid))
}

// Viewing is independent of allowMemberReceiptUploads. Anonymous guests who are
// current members may view only when listed in receiptViewerIds. Admins always can.
export const canViewTripReceipts = (trip, identity) => {
  const uid = identity?.uid
  if (!isActiveTripParticipant(trip, identity)) return false
  const isAdmin = trip.createdBy === uid
    || (Array.isArray(trip.memberIds) && trip.memberIds.includes(uid) && Array.isArray(trip.adminIds) && trip.adminIds.includes(uid))
  if (isAdmin) return true
  return getReceiptViewerIds(trip).includes(uid)
}

// Upload does not use receiptViewerIds or the stored member isGuest flag.
// Anonymous Firebase sessions stay denied. A signed-in member is allowed when
// the trip flag is on, even if an older trip record still says isGuest.
export const canUploadTripReceipts = (trip, identity) => {
  if (!isActiveTripParticipant(trip, identity) || identity?.isAnonymous === true) return false
  const email = identity.email?.trim().toLowerCase()
  if (identity.uid === trip.createdBy && email === 'tsmane8787@gmail.com' && identity.emailVerified === true) return true
  return trip.allowMemberReceiptUploads === true
}
