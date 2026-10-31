import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildDashboardMetrics, computeBalances, computeSettlementSuggestions } from '../src/lib/balances.js'
import { validateExpenseForWrite, validateSettlementForWrite } from '../src/lib/financialValidation.js'
import { formatCurrency, fromMinorUnits, parseMinorUnits, toMinorUnits } from '../src/lib/money.js'
import { buildSplitAmongPayload, resolveSplitAmounts, validateSplitConfig } from '../src/lib/splits.js'
import { runInFlightOnce } from '../src/lib/inFlight.js'
import { parseReceiptText } from '../src/lib/receipt.js'

const sumSharesMinor = (shares, currency) => shares.reduce((sum, item) => sum + toMinorUnits(item.amount, currency), 0)
const members = ['a', 'b', 'c'].map((uid) => ({ uid, name: uid.toUpperCase() }))

test('money parsing uses exact minor units and currency-specific precision', () => {
  assert.equal(parseMinorUnits('100.50', 'INR'), 10050)
  assert.equal(parseMinorUnits(100.5, 'INR'), 10050)
  assert.equal(parseMinorUnits('1.005', 'INR'), 101)
  assert.equal(parseMinorUnits('1,00,000.50', 'INR'), 10000050)
  assert.equal(parseMinorUnits('1,2.50', 'INR'), null)
  assert.equal(parseMinorUnits('100.5', 'JPY'), 101)
  assert.equal(parseMinorUnits('1.234', 'BHD'), 1234)
  assert.equal(toMinorUnits('not money', 'INR'), 0)
})

test('display formatting respects currency minor-unit precision', () => {
  assert.equal(formatCurrency(100.5, 'INR'), '₹100.50')
  assert.equal(formatCurrency(100.5, 'JPY'), '¥101')
  assert.equal(fromMinorUnits(10050, 'INR'), 100.5)
})

test('receipt parsing uses the trip currency precision without changing calculations', () => {
  assert.equal(parseReceiptText('Cafe\nGrand total ₹100.50', 'INR').amount, '100.5')
  assert.equal(parseReceiptText('Hotel\nTotal 100.50', 'JPY').amount, '101')
})

test('equal INR split allocates indivisible paise by selected order and reconciles exactly', () => {
  const shares = resolveSplitAmounts({
    amount: '100.00', currency: 'INR', splitMode: 'equal',
    splitAmong: [{ uid: 'a', value: 1 }, { uid: 'b', value: 1 }, { uid: 'c', value: 1 }],
  })
  assert.deepEqual(shares.map((item) => item.amount), [33.34, 33.33, 33.33])
  assert.equal(sumSharesMinor(shares, 'INR'), 10000)
})

test('equal split handles selected members, single-member splits and zero-decimal currencies', () => {
  const participants = ['b', 'c'].map((uid) => ({ uid, value: 1 }))
  assert.deepEqual(resolveSplitAmounts({ amount: 1, currency: 'INR', splitMode: 'equal', splitAmong: participants }), [
    { uid: 'b', amount: 0.5 }, { uid: 'c', amount: 0.5 },
  ])
  assert.deepEqual(resolveSplitAmounts({ amount: 10, currency: 'JPY', splitMode: 'equal', splitAmong: members }), [
    { uid: 'a', amount: 4 }, { uid: 'b', amount: 3 }, { uid: 'c', amount: 3 },
  ])
  assert.deepEqual(resolveSplitAmounts({ amount: 1, currency: 'INR', splitMode: 'equal', splitAmong: [{ uid: 'a', value: 1 }] }), [{ uid: 'a', amount: 1 }])
})

test('percentage and weighted-share splits use largest remainders and always reconcile', () => {
  const percentages = [{ uid: 'a', value: 33.33 }, { uid: 'b', value: 33.33 }, { uid: 'c', value: 33.34 }]
  const percentShares = resolveSplitAmounts({ amount: 1, currency: 'INR', splitMode: 'percentage', splitAmong: percentages })
  assert.equal(sumSharesMinor(percentShares, 'INR'), 100)
  assert.deepEqual(percentShares.map((item) => item.amount), [0.33, 0.33, 0.34])
  const weighted = resolveSplitAmounts({ amount: 100.01, currency: 'INR', splitMode: 'shares', splitAmong: [
    { uid: 'a', value: 1 }, { uid: 'b', value: 2 }, { uid: 'c', value: 3 },
  ] })
  assert.equal(sumSharesMinor(weighted, 'INR'), 10001)
  assert.deepEqual(weighted.map((item) => item.amount), [16.67, 33.34, 50])
})

test('exact amount splits retain entered shares and validation requires exact minor-unit reconciliation', () => {
  const exact = [{ uid: 'a', value: 33.34 }, { uid: 'b', value: 33.33 }, { uid: 'c', value: 33.33 }]
  assert.equal(sumSharesMinor(resolveSplitAmounts({ amount: 100, currency: 'INR', splitMode: 'exact', splitAmong: exact }), 'INR'), 10000)
  assert.equal(validateSplitConfig({ amount: '100', currency: 'INR', splitMode: 'exact', selectedMemberIds: ['a', 'b', 'c'], splitValues: { a: '33.34', b: '33.33', c: '33.33' } }).valid, true)
  assert.equal(validateSplitConfig({ amount: '100', currency: 'INR', splitMode: 'exact', selectedMemberIds: ['a', 'b'], splitValues: { a: '50', b: '49.99' } }).valid, false)
  assert.equal(validateExpenseForWrite({ currency: 'INR', values: { title: 'Dinner', amount: '100', paidBy: 'a', splitMode: 'exact', splitAmong: exact } }).valid, true)
})

test('validates amount, participant uniqueness, percentages, payer membership and settlements', () => {
  assert.equal(validateSplitConfig({ amount: '-1', splitMode: 'equal', selectedMemberIds: ['a'], splitValues: {} }).valid, false)
  assert.equal(validateSplitConfig({ amount: '0', splitMode: 'equal', selectedMemberIds: ['a'], splitValues: {} }).valid, false)
  assert.equal(validateSplitConfig({ amount: '1', splitMode: 'equal', selectedMemberIds: ['a', 'a'], splitValues: {} }).valid, false)
  assert.equal(validateSplitConfig({ amount: '1', splitMode: 'percentage', selectedMemberIds: ['a', 'b'], splitValues: { a: '50', b: '49.99' } }).valid, false)
  assert.equal(validateExpenseForWrite({ currency: 'INR', memberIds: ['a'], values: { title: 'x', amount: 1, paidBy: 'b', splitMode: 'equal', splitAmong: [{ uid: 'a', value: 1 }] } }).valid, false)
  assert.equal(validateSettlementForWrite({ currency: 'INR', memberIds: ['a', 'b'], values: { from: 'a', to: 'b', amount: '-1', method: 'cash' } }).valid, false)
  assert.equal(validateSettlementForWrite({ currency: 'INR', memberIds: ['a', 'b'], values: { from: 'a', to: 'a', amount: '1', method: 'cash' } }).valid, false)
  assert.equal(validateSettlementForWrite({ currency: 'INR', memberIds: ['a', 'b'], values: { from: 'a', to: 'b', amount: '1', method: 'cash' } }).valid, true)
})

test('payer and creator are independent and legacy missing split members split across the trip roster', () => {
  const expense = { id: 'legacy', amount: 90.01, paidBy: 'a', createdBy: 'b' }
  const balances = computeBalances({ trip: { currency: 'INR', members }, expenses: [expense] })
  assert.equal(balances.find((item) => item.uid === 'a').paid, 90.01)
  assert.equal(balances.reduce((sum, item) => sum + toMinorUnits(item.net, 'INR'), 0), 0)
  assert.equal(balances.find((item) => item.uid === 'b').paid, 0)
})

test('a valid trip-member payer need not participate in the expense share', () => {
  const valid = validateExpenseForWrite({
    currency: 'INR', memberIds: ['a', 'b', 'c'],
    values: { title: 'Shared dinner', amount: '12', paidBy: 'a', splitMode: 'equal', splitAmong: [{ uid: 'b', value: 1 }, { uid: 'c', value: 1 }] },
  })
  assert.equal(valid.valid, true)
  const balances = computeBalances({
    trip: { currency: 'INR', members },
    expenses: [{ amount: 12, paidBy: 'a', createdBy: 'c', splitMode: 'equal', splitAmong: [{ uid: 'b', value: 1 }, { uid: 'c', value: 1 }] }],
  })
  assert.equal(balances.reduce((sum, item) => sum + toMinorUnits(item.net, 'INR'), 0), 0)
})

test('multiple expenses and settlements preserve the zero-sum balance equation', () => {
  const expenses = [
    { id: 'e1', amount: 100.01, paidBy: 'a', splitMode: 'equal', splitAmong: members.map(({ uid }) => ({ uid, value: 1 })) },
    { id: 'e2', amount: 29.99, paidBy: 'c', splitMode: 'exact', splitAmong: [{ uid: 'a', value: 20 }, { uid: 'b', value: 9.99 }] },
  ]
  const balances = computeBalances({ trip: { currency: 'INR', members }, expenses, settlements: [{ from: 'b', to: 'a', amount: 10 }] })
  assert.equal(balances.reduce((sum, item) => sum + toMinorUnits(item.net, 'INR'), 0), 0)
  assert.equal(balances.find((item) => item.uid === 'b').settledOut, 10)
  assert.ok(balances.find((item) => item.uid === 'b').net > -100)
})

test('partial and full settlement records reduce balances once by their recorded amounts', () => {
  const expenses = [{ amount: 90, paidBy: 'a', splitMode: 'equal', splitAmong: members.map(({ uid }) => ({ uid, value: 1 })) }]
  const partial = computeBalances({ trip: { currency: 'INR', members }, expenses, settlements: [{ from: 'b', to: 'a', amount: 10 }, { from: 'c', to: 'a', amount: 5 }] })
  assert.equal(partial.find((entry) => entry.uid === 'a').net, 45)
  assert.equal(partial.reduce((sum, entry) => sum + toMinorUnits(entry.net, 'INR'), 0), 0)
  const full = computeBalances({ trip: { currency: 'INR', members }, expenses, settlements: [{ from: 'b', to: 'a', amount: 30 }, { from: 'c', to: 'a', amount: 30 }] })
  assert.ok(full.every((entry) => entry.net === 0))
})

test('settlement suggestions clear the current net without changing total balances', () => {
  const expenses = [{ amount: 90, paidBy: 'a', splitMode: 'equal', splitAmong: members.map(({ uid }) => ({ uid, value: 1 })) }]
  const before = computeBalances({ trip: { currency: 'INR', members }, expenses })
  const suggestions = computeSettlementSuggestions(before, 'INR')
  const after = computeBalances({ trip: { currency: 'INR', members }, expenses, settlements: suggestions.map((item) => ({ from: item.from, to: item.to, amount: item.amount })) })
  assert.equal(suggestions.length, 2)
  assert.ok(after.every((entry) => entry.net === 0))
  assert.equal(suggestions.reduce((sum, item) => sum + toMinorUnits(item.amount, 'INR'), 0), 6000)
})

test('dashboard totals reconcile and settlements are excluded from expenses', () => {
  const metrics = buildDashboardMetrics({
    trip: { currency: 'INR', budget: 200, members },
    currentUserId: 'a',
    expenses: [{ id: 'e', title: 'Dinner', amount: 100.5, category: 'Food', paidBy: 'a', splitMode: 'equal', splitAmong: members.map(({ uid }) => ({ uid, value: 1 })) }],
    settlements: [{ from: 'b', to: 'a', amount: 10 }],
  })
  assert.equal(metrics.totalSpent, 100.5)
  assert.equal(metrics.yourPaid, 100.5)
  assert.equal(metrics.yourShare, 33.5)
  assert.equal(metrics.settledAmount, 10)
  assert.equal(metrics.budgetLeft, 99.5)
  assert.equal(metrics.outstandingAmount, 57)
  assert.equal(metrics.categoryData.find((item) => item.name === 'Food').value, 100.5)
})

test('random equal splits preserve every minor unit for varied totals and participant counts', () => {
  let seed = 0x12345678
  const random = (max) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % max }
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const total = random(10_000_000) + 1
    const count = random(20) + 1
    const splitAmong = Array.from({ length: count }, (_, index) => ({ uid: `m${index}`, value: 1 }))
    const result = resolveSplitAmounts({ amount: fromMinorUnits(total, 'INR'), currency: 'INR', splitMode: 'equal', splitAmong })
    assert.equal(sumSharesMinor(result, 'INR'), total)
  }
})

test('random weighted splits preserve every minor unit exactly', () => {
  let seed = 0x9e3779b9
  const random = (max) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % max }
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const totalMinor = random(1_000_000) + 1
    const count = random(10) + 1
    const splitAmong = Array.from({ length: count }, (_, index) => ({ uid: `m${index}`, value: random(10000) + 1 }))
    const result = resolveSplitAmounts({ amount: fromMinorUnits(totalMinor, 'INR'), currency: 'INR', splitMode: 'shares', splitAmong })
    assert.equal(sumSharesMinor(result, 'INR'), totalMinor)
  }
})

test('edit recalculation replaces the old expense value rather than counting both versions', () => {
  const original = { id: 'e', amount: 40, paidBy: 'a', splitMode: 'equal', splitAmong: [{ uid: 'a', value: 1 }, { uid: 'b', value: 1 }] }
  const edited = { ...original, amount: 60 }
  const metrics = buildDashboardMetrics({ trip: { currency: 'INR', members: members.slice(0, 2) }, expenses: [edited] })
  assert.equal(metrics.totalSpent, 60)
  assert.equal(metrics.balances.reduce((sum, entry) => sum + toMinorUnits(entry.net, 'INR'), 0), 0)
})

test('split form payload retains creator/payer distinction and exact currency amounts', () => {
  assert.deepEqual(buildSplitAmongPayload({ splitMode: 'exact', selectedMemberIds: ['a', 'b'], splitValues: { a: '12.34', b: '1' }, currency: 'INR' }), [
    { uid: 'a', value: 12.34 }, { uid: 'b', value: 1 },
  ])
})

test('identical simultaneous transaction submissions share one write; later intentional repeats are allowed', async () => {
  let writes = 0
  let markStarted
  const started = new Promise((resolve) => { markStarted = resolve })
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const write = () => runInFlightOnce('financial-test-double-submit', async () => {
    writes += 1
    markStarted()
    await gate
    return 'saved'
  })
  const first = write()
  const second = write()
  await started
  assert.equal(writes, 1)
  release()
  assert.deepEqual(await Promise.all([first, second]), ['saved', 'saved'])
  assert.equal(await write(), 'saved')
  assert.equal(writes, 2)
})
