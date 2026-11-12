import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEmptyRoutePoint,
  createEmptyTripRoute,
  buildRouteCanvasPath,
  getRouteCanvasCoordinates,
  getDefaultMaharashtraPosition,
  getNextUpcomingRoutePointId,
  getRouteProgress,
  getRouteStopProgress,
  getTripRouteCanvasPoints,
  getTripRoutePoints,
  isInsideMaharashtra,
  reorderTripRouteStop,
  setTripRouteCanvasPointPosition,
  setTripRoutePointStatus,
  validateTripRoute,
} from '../src/lib/tripRoute.js'

const today = new Date().toISOString().slice(0, 10)
const complete = (name, actualCompletionDate = today) => ({ ...createEmptyRoutePoint(name), status: 'completed', actualCompletionDate })
const routeWithStops = () => ({
  tripId: 'trip-1',
  start: complete('Pune'),
  stops: [
    { ...createEmptyRoutePoint('Nashik'), id: 'nashik', plannedArrivalDate: '2026-11-13', status: 'in_progress' },
    { ...createEmptyRoutePoint('Igatpuri'), id: 'igatpuri', plannedArrivalDate: '2026-11-14' },
  ],
  destination: createEmptyRoutePoint('Mumbai'),
})

test('a new route has no locations until endpoints are supplied', () => {
  const route = createEmptyTripRoute('trip-1')
  assert.deepEqual(getTripRoutePoints(route), [])
  assert.deepEqual(validateTripRoute(route).slice(0, 2), ['Starting location name is required.', 'Final destination name is required.'])
})

test('route points retain start, ordered stops, and destination sequence', () => {
  assert.deepEqual(getTripRoutePoints(routeWithStops()).map((point) => point.name), ['Pune', 'Nashik', 'Igatpuri', 'Mumbai'])
})

test('only the next upcoming route point is selected for animation', () => {
  assert.equal(getNextUpcomingRoutePointId(routeWithStops()), 'igatpuri')
  const completeStop = setTripRoutePointStatus(routeWithStops(), 'nashik', 'completed', today)
  assert.equal(getNextUpcomingRoutePointId(completeStop), 'igatpuri')
  assert.equal(getNextUpcomingRoutePointId({ start: complete('Pune'), stops: [], destination: complete('Mumbai') }), '')
})

test('completion progress is derived only from visible ordered locations', () => {
  assert.deepEqual(getRouteProgress(routeWithStops()), { completed: 1, total: 4, remaining: 3, percent: 25 })
})

test('map stop progress handles zero, partial, and fully completed stops', () => {
  assert.deepEqual(getRouteStopProgress(createEmptyTripRoute('trip-1')), { completed: 0, total: 0, remaining: 0, percent: 0 })

  const partialRoute = routeWithStops()
  partialRoute.stops = [
    complete('Nashik'),
    { ...createEmptyRoutePoint('Igatpuri'), id: 'igatpuri', status: 'in_progress' },
    createEmptyRoutePoint('Lonavala'),
  ]
  assert.deepEqual(getRouteStopProgress(partialRoute), { completed: 1, total: 3, remaining: 2, percent: 33 })

  partialRoute.stops = [complete('Nashik'), complete('Igatpuri'), complete('Lonavala')]
  assert.deepEqual(getRouteStopProgress(partialRoute), { completed: 3, total: 3, remaining: 0, percent: 100 })
})

test('marking the in-progress point complete records the actual date', () => {
  const next = setTripRoutePointStatus(routeWithStops(), 'nashik', 'completed', today)
  assert.equal(next.stops[0].actualCompletionDate, today)
  assert.equal(next.stops[0].status, 'completed')
  assert.equal(getNextUpcomingRoutePointId(next), 'igatpuri')
})

test('route stop order can be changed without mutating the original route', () => {
  const route = routeWithStops()
  route.stops[0].status = 'upcoming'
  const reordered = reorderTripRouteStop(route, 'igatpuri', -1)
  assert.deepEqual(reordered.stops.map((stop) => stop.id), ['igatpuri', 'nashik'])
  assert.deepEqual(route.stops.map((stop) => stop.id), ['nashik', 'igatpuri'])
})

test('route stop arrows move exactly one step and cannot cross endpoint boundaries', () => {
  const route = routeWithStops()
  route.stops[0].status = 'upcoming'
  assert.deepEqual(reorderTripRouteStop(route, 'nashik', 1).stops.map((stop) => stop.id), ['igatpuri', 'nashik'])
  assert.deepEqual(reorderTripRouteStop(route, 'igatpuri', -1).stops.map((stop) => stop.id), ['igatpuri', 'nashik'])
  assert.deepEqual(reorderTripRouteStop(route, 'nashik', -1).stops.map((stop) => stop.id), ['nashik', 'igatpuri'])
  assert.deepEqual(reorderTripRouteStop(route, 'igatpuri', 1).stops.map((stop) => stop.id), ['nashik', 'igatpuri'])
  assert.equal(reorderTripRouteStop(route, 'start', 1), route)
  assert.equal(reorderTripRouteStop(route, 'destination', -1), route)
  assert.throws(() => reorderTripRouteStop(route, 'nashik', -2), /one position at a time/)
  assert.deepEqual(getTripRoutePoints(route).map((point) => point.type), ['start', 'stop', 'stop', 'destination'])
})

test('legacy route points receive generated canvas positions without changing stored data', () => {
  const route = routeWithStops()
  const canvasPoints = getTripRouteCanvasPoints(route)
  assert.ok(canvasPoints.every((point) => isInsideMaharashtra(point.canvasPosition)))
  assert.equal(route.start.canvasPosition, undefined)
})

test('dragging a canvas marker saves its position while keeping route order and endpoints', () => {
  const route = routeWithStops()
  route.stops[0].status = 'upcoming'
  const moved = setTripRouteCanvasPointPosition(route, 'nashik', { x: 85.456, y: 24.22 })
  assert.deepEqual(moved.stops.map((stop) => stop.id), ['nashik', 'igatpuri'])
  assert.deepEqual(moved.stops[0].canvasPosition, { x: 85.5, y: 24.2 })
  assert.ok(isInsideMaharashtra(moved.stops[0].canvasPosition))
  assert.equal(moved.start.name, 'Pune')
  assert.equal(moved.destination.name, 'Mumbai')
  assert.ok(isInsideMaharashtra(moved.start.canvasPosition))
  assert.ok(isInsideMaharashtra(moved.destination.canvasPosition))
  assert.equal(route.stops[0].id, 'nashik')
})

test('canvas coordinates and smooth path geometry are bounded and deterministic', () => {
  const points = getTripRouteCanvasPoints(routeWithStops())
  const halfway = getRouteCanvasCoordinates({ x: 50, y: 50 })
  assert.equal(halfway.x, 50)
  assert.ok(Math.abs(halfway.y - 41.2987285) < 1e-8)
  assert.match(buildRouteCanvasPath(points), /^M /)
  assert.throws(() => setTripRouteCanvasPointPosition(routeWithStops(), 'nashik', { x: 50, y: 0 }), /inside Maharashtra/)
  assert.throws(() => setTripRouteCanvasPointPosition(routeWithStops(), 'nashik', { x: 120, y: 40 }), /inside Maharashtra/)
  assert.throws(() => setTripRouteCanvasPointPosition(routeWithStops(), 'missing', { x: 50, y: 40 }), /no longer available/)
})

test('route locations use Maharashtra-shaped normalized coordinates and reordering preserves pin positions', () => {
  const route = routeWithStops()
  route.stops[0].status = 'upcoming'
  route.start.canvasPosition = { x: 0, y: 50 } // Legacy schematic coordinate, outside the state.
  const original = route.stops.map((stop) => ({ ...stop, canvasPosition: getDefaultMaharashtraPosition(route.stops.indexOf(stop) + 1, 4) }))
  route.stops = original
  const normalized = getTripRouteCanvasPoints(route)
  assert.ok(normalized.every((point) => isInsideMaharashtra(point.canvasPosition)))
  assert.equal(route.start.canvasPosition.x, 0, 'legacy coordinates are not mutated during display')
  const reordered = reorderTripRouteStop(route, 'nashik', 1)
  assert.deepEqual(reordered.stops.map((stop) => stop.id), ['igatpuri', 'nashik'])
  assert.deepEqual(reordered.stops.map((stop) => stop.canvasPosition), route.stops.slice().reverse().map((stop) => stop.canvasPosition))
})

test('new route pins receive valid normalized positions within the Maharashtra boundary', () => {
  for (let count = 2; count <= 20; count += 1) {
    for (let index = 0; index < count; index += 1) assert.ok(isInsideMaharashtra(getDefaultMaharashtraPosition(index, count)))
  }
})

test('route rejects duplicate locations and invalid dates', () => {
  const duplicate = routeWithStops()
  duplicate.destination.name = 'Pune'
  assert.ok(validateTripRoute(duplicate).some((message) => message.includes('distinct names')))

  const invalidDate = routeWithStops()
  invalidDate.stops[1].plannedArrivalDate = '2026-02-30'
  assert.ok(validateTripRoute(invalidDate).some((message) => message.includes('date is invalid')))

  const futureActual = routeWithStops()
  futureActual.start.actualCompletionDate = '2999-12-31'
  assert.ok(validateTripRoute(futureActual).some((message) => message.includes('cannot be in the future')))

})

test('route rejects invalid completion ordering and multiple in-progress points', () => {
  const invalid = routeWithStops()
  invalid.stops[1] = { ...invalid.stops[1], status: 'in_progress' }
  assert.ok(validateTripRoute(invalid).some((message) => message.includes('Only the next route location')))

  const completedLater = routeWithStops()
  completedLater.destination = complete('Mumbai')
  assert.ok(validateTripRoute(completedLater).some((message) => message.includes('Complete earlier locations')))
})

test('route rejects empty names, missing actual completion dates, and unknown updates', () => {
  const missingName = routeWithStops()
  missingName.stops[0].name = '  '
  assert.ok(validateTripRoute(missingName).some((message) => message.includes('name is required')))

  const missingActual = routeWithStops()
  missingActual.stops[0].actualCompletionDate = ''
  missingActual.stops[0].status = 'completed'
  assert.ok(validateTripRoute(missingActual).some((message) => message.includes('actual completion date')))

  assert.throws(() => setTripRoutePointStatus(routeWithStops(), 'removed-stop', 'completed', today), /no longer available/)
})
