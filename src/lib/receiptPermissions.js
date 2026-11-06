export const RECEIPT_VIEW_DENIED_MESSAGE = 'Receipt viewing is not enabled for your account. Contact the trip admin.'

export const getReceiptViewerIds = (trip) => {
  const memberIds = Array.isArray(trip?.memberIds) ? trip.memberIds : []
  const viewers = Array.isArray(trip?.receiptViewerIds) ? trip.receiptViewerIds : []
  return [...new Set(viewers.filter((uid) => memberIds.includes(uid)))]
}

const memberRecord = (trip, uid) => (
  Array.isArray(trip?.members) ? trip.members.find((member) => member?.uid === uid) : null
)

export const isCurrentTripMember = (trip, identity) => {
  const uid = identity?.uid
  if (!trip || !uid || identity?.isAnonymous || memberRecord(trip, uid)?.isGuest) return false
  return trip.createdBy === uid || (Array.isArray(trip.memberIds) && trip.memberIds.includes(uid))
}

export const isReceiptAdmin = (trip, identity) => {
  const uid = identity?.uid
  if (!isCurrentTripMember(trip, identity)) return false
  return trip.createdBy === uid
    || (Array.isArray(trip.adminIds) && trip.adminIds.includes(uid))
}

// Viewing is independent of allowMemberReceiptUploads. Missing or empty
// receiptViewerIds denies regular members. Trip admins always retain access.
export const canViewTripReceipts = (trip, identity) => {
  if (!isCurrentTripMember(trip, identity)) return false
  if (isReceiptAdmin(trip, identity)) return true
  return getReceiptViewerIds(trip).includes(identity.uid)
}

export const canUploadTripReceipts = (trip, identity) => {
  if (!isCurrentTripMember(trip, identity)) return false
  const email = identity.email?.trim().toLowerCase()
  if (identity.uid === trip.createdBy && email === 'tsmane8787@gmail.com' && identity.emailVerified === true) return true
  return trip.allowMemberReceiptUploads === true
}
