import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEmptyRoutePoint,
  createEmptyTripRoute,
  getNextUpcomingRoutePointId,
  getRouteProgress,
  getTripRoutePoints,
  reorderTripRouteStop,
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
