export const isTripAdministrator = (trip, uid) => Boolean(
  trip
  && uid
  && (trip.createdBy === uid
    || (trip.memberIds?.includes(uid) && trip.adminIds?.includes(uid))),
)

export const canManageTripSettlements = (trip, uid) => Boolean(
  isTripAdministrator(trip, uid)
  || (trip?.memberIds?.includes(uid) && trip?.settlementManagerIds?.includes(uid)),
)

export const getSettlementManagerIds = (trip) => {
  const memberIds = Array.isArray(trip?.memberIds) ? trip.memberIds : []
  const managers = Array.isArray(trip?.settlementManagerIds) ? trip.settlementManagerIds : []
  return [...new Set(managers.filter((uid) => memberIds.includes(uid)))]
}
