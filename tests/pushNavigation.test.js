import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getPushDestination } from '../src/lib/pushNavigation.js'

test('push taps route only to supported trip tabs', () => {
  assert.equal(getPushDestination({ tripId: 'trip-1', destination: 'expenses' }), '/trips/trip-1?tab=expenses')
  assert.equal(getPushDestination({ tripId: 'trip-1', destination: 'expenses', recordId: 'expense-1' }), '/trips/trip-1?tab=expenses&expenseId=expense-1')
  assert.equal(getPushDestination({ tripId: 'trip-1', destination: 'unknown' }), '/trips/trip-1?tab=overview')
})

test('push tap ignores malformed trip identifiers', () => {
  assert.equal(getPushDestination({ tripId: '../users/secret', destination: 'expenses' }), null)
  assert.equal(getPushDestination({ destination: 'expenses' }), null)
})
