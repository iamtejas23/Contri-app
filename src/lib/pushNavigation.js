const supportedTabs = new Set(['overview', 'expenses', 'settlements', 'advances', 'activity'])

export const getPushDestination = (data = {}) => {
  const tripId = data.tripId
  if (typeof tripId !== 'string' || !tripId || tripId.includes('/')) return null
  const tab = supportedTabs.has(data.destination) ? data.destination : 'overview'
  const params = new URLSearchParams({ tab })
  if (tab === 'expenses' && typeof data.recordId === 'string' && data.recordId && !data.recordId.includes('/')) {
    params.set('expenseId', data.recordId)
  }
  return `/trips/${encodeURIComponent(tripId)}?${params.toString()}`
}
