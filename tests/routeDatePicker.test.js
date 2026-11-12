import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { getMonthCalendar, parseDateOnly, shiftCalendarMonth, toDateOnly, WEEKDAY_LABELS } from '../src/lib/routeDatePicker.js'

test('date-only parsing rejects invalid dates without timezone shifting', () => {
  assert.equal(toDateOnly(parseDateOnly('2024-02-29')), '2024-02-29')
  assert.equal(parseDateOnly('2025-02-29'), null)
  assert.equal(parseDateOnly('2025-13-01'), null)
  assert.equal(parseDateOnly('not-a-date'), null)
})

test('month grid uses Monday-first alignment and includes leap day', () => {
  assert.deepEqual(WEEKDAY_LABELS, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  const february = getMonthCalendar(2024, 1)
  assert.equal(february[0], null)
  assert.ok(february.includes('2024-02-29'))
  assert.equal(february.filter(Boolean).length, 29)
})

test('calendar navigation crosses years correctly', () => {
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 })
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 })
})

test('route date calendar stays in normal flow and uses seven shrinkable columns', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const component = await readFile(new URL('../src/components/ui/DateField.jsx', import.meta.url), 'utf8')
  assert.match(css, /\.route-date-calendar\s*\{[^}]*width:\s*100%;[^}]*overflow:\s*hidden/s)
  assert.match(css, /\.route-date-grid\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(component, /className="route-date-calendar" role="group"/)
  assert.doesNotMatch(component, /type="date"/)
})
