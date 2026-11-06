export const getMemberGroupRoles = (member, trip, settlementManagerIds = []) => {
  const uid = member?.uid
  const isCreator = Boolean(uid && trip?.createdBy === uid)
  const isAdmin = isCreator || member?.role === 'admin' || (Array.isArray(trip?.adminIds) && trip.adminIds.includes(uid))
  const isSettlementManager = Boolean(uid && !isAdmin && settlementManagerIds.includes(uid))
  const roles = []
  if (isCreator) roles.push({ id: 'creator', label: 'Trip creator' })
  else if (isAdmin) roles.push({ id: 'admin', label: 'Trip Admin' })
  else roles.push({ id: 'member', label: 'Member' })
  if (isSettlementManager) roles.push({ id: 'settlement', label: 'Settlement Manager' })
  return { isCreator, isAdmin, isSettlementManager, roles }
}

export const getReceiptViewStatus = ({ member, trip, viewerIds = [] }) => {
  const uid = member?.uid
  const isAdmin = Boolean(
    uid
    && (trip?.createdBy === uid || (trip?.memberIds?.includes(uid) && trip?.adminIds?.includes(uid))),
  )
  if (isAdmin) {
    return { isAdmin: true, enabled: true, label: 'Receipt access enabled', detail: 'Trip admins always can view receipts.' }
  }
  if (viewerIds.includes(uid)) {
    return { isAdmin: false, enabled: true, label: 'Receipt access enabled', detail: 'Can view receipts' }
  }
  return { isAdmin: false, enabled: false, label: 'Receipt access disabled', detail: 'Can view receipts has not been granted.' }
}
