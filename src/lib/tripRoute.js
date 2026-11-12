export const ROUTE_POINT_STATUSES = ['upcoming', 'in_progress', 'completed']
export const MAX_ROUTE_STOPS = 48

export const createEmptyRoutePoint = (name = '') => ({
  name,
  description: '',
  plannedArrivalDate: '',
  actualCompletionDate: '',
  status: 'upcoming',
})

export const createEmptyTripRoute = (tripId = '') => ({
  tripId,
  start: createEmptyRoutePoint(),
  stops: [],
  destination: createEmptyRoutePoint(),
})

export const getTripRoutePoints = (route) => {
  if (!route) return []
  return [
    { ...route.start, id: 'start', type: 'start' },
    ...(Array.isArray(route.stops) ? route.stops.map((stop) => ({ ...stop, type: 'stop' })) : []),
    { ...route.destination, id: 'destination', type: 'destination' },
  ].filter((point) => point.name?.trim())
}

const isIsoDate = (value) => {
  if (value === '') return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const validatePoint = (point, label) => {
  const errors = []
  if (!point || typeof point !== 'object' || Array.isArray(point)) return [`${label} is invalid.`]
  const name = typeof point.name === 'string' ? point.name.trim() : ''
  if (!name) errors.push(`${label} name is required.`)
  if (name.length > 120) errors.push(`${label} name must be 120 characters or fewer.`)
  if (typeof point.description !== 'string' || point.description.length > 240) errors.push(`${label} description must be 240 characters or fewer.`)
  if (!isIsoDate(point.plannedArrivalDate)) errors.push(`${label} planned arrival date is invalid.`)
  if (!isIsoDate(point.actualCompletionDate)) errors.push(`${label} actual completion date is invalid.`)
  if (point.actualCompletionDate && point.actualCompletionDate > new Date().toISOString().slice(0, 10)) errors.push(`${label} actual completion date cannot be in the future.`)
  if (point.canvasPosition !== undefined && (
    !point.canvasPosition || typeof point.canvasPosition !== 'object' || Array.isArray(point.canvasPosition)
    || Object.keys(point.canvasPosition).some((key) => !['x', 'y'].includes(key))
    || !Number.isFinite(point.canvasPosition.x) || !Number.isFinite(point.canvasPosition.y)
    || point.canvasPosition.x < 0 || point.canvasPosition.x > 100
    || point.canvasPosition.y < 0 || point.canvasPosition.y > 100
  )) errors.push(`${label} canvas position is invalid.`)
  if (!ROUTE_POINT_STATUSES.includes(point.status)) errors.push(`${label} status is invalid.`)
  if (point.status === 'completed' && !point.actualCompletionDate) errors.push(`${label} needs an actual completion date.`)
  if (point.status !== 'completed' && point.actualCompletionDate) errors.push(`${label} cannot have an actual completion date until it is completed.`)
  return errors
}

export const validateTripRoute = (route) => {
  if (!route || typeof route !== 'object') return ['Route details are missing.']
  const stops = Array.isArray(route.stops) ? route.stops : []
  if (stops.length > MAX_ROUTE_STOPS) return [`A route can have up to ${MAX_ROUTE_STOPS} intermediate stops.`]
  const points = [route.start, ...stops, route.destination]
  const labels = ['Starting location', ...stops.map((_, index) => `Stop ${index + 1}`), 'Final destination']
  const errors = points.flatMap((point, index) => validatePoint(point, labels[index]))

  if (stops.some((stop) => !stop?.id || typeof stop.id !== 'string' || stop.id.length > 80)) errors.push('Every route stop needs a valid identifier.')
  const ids = stops.map((stop) => stop?.id).filter(Boolean)
  if (new Set(ids).size !== ids.length) errors.push('Route stop identifiers must be unique.')

  const names = points.map((point) => (typeof point?.name === 'string' ? point.name.trim().toLocaleLowerCase() : '')).filter(Boolean)
  if (new Set(names).size !== names.length) errors.push('Route locations must have distinct names.')

  const inProgressCount = points.filter((point) => point?.status === 'in_progress').length
  if (inProgressCount > 1) errors.push('Only one route location can be in progress at a time.')

  let statusStage = 0
  let inProgressSeen = false
  for (const point of points) {
    if (!point || !ROUTE_POINT_STATUSES.includes(point.status)) continue
    if (point.status === 'completed') {
      if (statusStage > 0) errors.push('Complete earlier locations before completing a later one.')
    } else if (point.status === 'in_progress') {
      if (statusStage > 1 || inProgressSeen) errors.push('Only the next route location can be in progress.')
      statusStage = 1
      inProgressSeen = true
    } else {
      statusStage = 2
    }
  }

  return [...new Set(errors)]
}

export const getRouteProgress = (route) => {
  const points = getTripRoutePoints(route)
  const completed = points.filter((point) => point.status === 'completed').length
  return { completed, total: points.length, remaining: points.length - completed, percent: points.length ? Math.round((completed / points.length) * 100) : 0 }
}

export const getNextUpcomingRoutePointId = (route) => (
  getTripRoutePoints(route).find((point) => point.status === 'upcoming')?.id || ''
)

export const reorderTripRouteStop = (route, stopId, offset) => {
  if (!Number.isInteger(offset) || Math.abs(offset) !== 1) throw new Error('Route stops can only move one position at a time.')
  const stops = [...(route?.stops || [])]
  const index = stops.findIndex((stop) => stop.id === stopId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= stops.length) return route
  ;[stops[index], stops[target]] = [stops[target], stops[index]]
  const hasCanvasLayout = Boolean(route?.start?.canvasPosition || route?.destination?.canvasPosition || stops.some((stop) => stop.canvasPosition))
  const positionedStops = hasCanvasLayout
    ? stops.map((stop, stopIndex) => ({ ...stop, canvasPosition: { ...(stop.canvasPosition || { y: [32, 68, 24, 76][stopIndex % 4] }), x: ((stopIndex + 1) / (stops.length + 1)) * 100 } }))
    : stops
  const next = { ...route, stops: positionedStops }
  const errors = validateTripRoute(next)
  if (errors.length) throw new Error(errors[0])
  return next
}

export const getTripRouteCanvasPoints = (route) => {
  const stops = Array.isArray(route?.stops) ? route.stops : []
  const fallback = new Map([
    ['start', { x: 0, y: 50 }],
    ['destination', { x: 100, y: 50 }],
    ...stops.map((stop, index) => [stop.id, {
      x: ((index + 1) / (stops.length + 1)) * 100,
      y: [32, 68, 24, 76][index % 4],
    }]),
  ])
  return getTripRoutePoints(route).map((point) => ({
    ...point,
    canvasPosition: point.canvasPosition || fallback.get(point.id) || { x: 50, y: 50 },
  }))
}

export const setTripRouteCanvasPointPosition = (route, pointId, position) => {
  const points = getTripRouteCanvasPoints(route)
  if (!points.some((point) => point.id === pointId)) throw new Error('That route location is no longer available.')
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) {
    throw new Error('Choose a position inside the route canvas.')
  }

  const positioned = points.map((point) => ({ ...point, canvasPosition: point.id === pointId ? { x: Math.round(position.x * 10) / 10, y: Math.round(position.y * 10) / 10 } : point.canvasPosition }))
  const byId = new Map(positioned.map((point) => [point.id, point]))
  const next = {
    ...route,
    start: { ...route.start, canvasPosition: byId.get('start').canvasPosition },
    stops: positioned.filter((point) => point.type === 'stop').sort((a, b) => a.canvasPosition.x - b.canvasPosition.x).map((point) => ({ ...route.stops.find((stop) => stop.id === point.id), canvasPosition: point.canvasPosition })),
    destination: { ...route.destination, canvasPosition: byId.get('destination').canvasPosition },
  }
  const errors = validateTripRoute(next)
  if (errors.length) throw new Error(errors[0])
  return next
}

export const getRouteCanvasCoordinates = (position, viewWidth, viewHeight = 100) => ({
  x: 8 + (position.x / 100) * (viewWidth - 16),
  y: 18 + (position.y / 100) * (viewHeight - 36),
})

export const buildRouteCanvasPath = (points, viewWidth, viewHeight = 100) => {
  const coords = points.map((point) => getRouteCanvasCoordinates(point.canvasPosition, viewWidth, viewHeight))
  if (!coords.length) return ''
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`
  return coords.slice(1).reduce((path, current, index) => {
    const previous = coords[index]
    const before = coords[index - 1] || previous
    const after = coords[index + 2] || current
    const controlOne = { x: previous.x + (current.x - before.x) / 6, y: previous.y + (current.y - before.y) / 6 }
    const controlTwo = { x: current.x - (after.x - previous.x) / 6, y: current.y - (after.y - previous.y) / 6 }
    return `${path} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${current.x} ${current.y}`
  }, `M ${coords[0].x} ${coords[0].y}`)
}

export const setTripRoutePointStatus = (route, pointId, status, actualDate = '') => {
  if (!ROUTE_POINT_STATUSES.includes(status)) throw new Error('Choose a valid route status.')
  const knownPoint = pointId === 'start' || pointId === 'destination' || route?.stops?.some((stop) => stop.id === pointId)
  if (!knownPoint) throw new Error('That route location is no longer available.')
  const completeDate = status === 'completed' ? actualDate : ''
  const update = (point, id) => id === pointId
    ? { ...point, status, actualCompletionDate: completeDate }
    : point
  const next = {
    ...route,
    start: update(route.start, 'start'),
    stops: route.stops.map((stop) => update(stop, stop.id)),
    destination: update(route.destination, 'destination'),
  }
  const errors = validateTripRoute(next)
  if (errors.length) throw new Error(errors[0])
  return next
}
