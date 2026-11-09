import assert from 'node:assert/strict'
import test from 'node:test'

import { activeAdvanceRecords, summarizeAdvances, validateAdvanceInput } from '../src/lib/advances.js'
import { buildDashboardMetrics, computeBalances, computeSettlementSuggestions } from '../src/lib/balances.js'
import { toMinorUnits } from '../src/lib/money.js'

const members = [
  { uid: 'a', name: 'Ada' },
  { uid: 'b', name: 'Ben' },
]
const trip = { currency: 'INR', members, memberIds: ['a', 'b'], createdBy: 'a', adminIds: ['a'] }
const expense = {
  id: 'hotel',
  amount: 5000,
  paidBy: 'a',
  splitMode: 'equal',
  splitAmong: members.map(({ uid }) => ({ uid, value: 1 })),
}

test('advance validation stores positive integer paise and rejects empty or zero amounts', () => {
  assert.equal(validateAdvanceInput({ memberUid: 'b', amount: '500', paymentDate: '2026-06-01', memberIds: ['a', 'b'] }).value.amountPaise, 50000)
  assert.equal(validateAdvanceInput({ memberUid: 'b', amount: '0', paymentDate: '2026-06-01', memberIds: ['a', 'b'] }).valid, false)
  assert.equal(validateAdvanceInput({ memberUid: 'b', amount: '-10', paymentDate: '2026-06-01', memberIds: ['a', 'b'] }).valid, false)
  assert.equal(validateAdvanceInput({ memberUid: 'b', amount: 'abc', paymentDate: '2026-06-01', memberIds: ['a', 'b'] }).valid, false)
  assert.equal(validateAdvanceInput({ memberUid: 'missing', amount: '10', paymentDate: '2026-06-01', memberIds: ['a', 'b'] }).valid, false)
  assert.equal(validateAdvanceInput({ memberUid: 'b', amount: '10', paymentDate: '2026-13-01', memberIds: ['a', 'b'] }).valid, false)
  assert.equal(validateAdvanceInput({ memberUid: 'b', amount: '1000001', paymentDate: '2026-06-01', memberIds: ['a', 'b'] }).valid, false)
})

test('multiple advances accumulate in paise without replacing earlier payments', () => {
  const advances = [
    { id: '1', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 50000 },
    { id: '2', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 100000 },
    { id: '3', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 50000 },
  ]
  const summary = summarizeAdvances({ members, advances })
  assert.equal(summary.totalPaise, 200000)
  assert.equal(summary.contributed.get('b'), 200000)
  assert.equal(summary.contributedCount, 1)
  assert.equal(summary.pendingCount, 1)
  assert.equal(activeAdvanceRecords(advances).length, 3)
})

test('advances reduce remaining contribution and do not change who paid or expense totals', () => {
  const advances = [
    { id: '1', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 200000 },
  ]
  const without = computeBalances({ trip, expenses: [expense] })
  const withAdvance = computeBalances({ trip, expenses: [expense], advances })
  assert.equal(withAdvance.find((entry) => entry.uid === 'a').paid, 5000)
  assert.equal(withAdvance.find((entry) => entry.uid === 'b').paid, 0)
  assert.equal(withAdvance.find((entry) => entry.uid === 'b').share, 2500)
  assert.equal(withAdvance.find((entry) => entry.uid === 'b').advance, 2000)
  assert.equal(withAdvance.find((entry) => entry.uid === 'b').remainingContribution, 500)
  assert.equal(without.find((entry) => entry.uid === 'a').paid, withAdvance.find((entry) => entry.uid === 'a').paid)
  const metrics = buildDashboardMetrics({ trip, expenses: [expense], advances })
  const baseline = buildDashboardMetrics({ trip, expenses: [expense] })
  assert.equal(metrics.totalSpent, 5000)
  assert.equal(metrics.totalSpent, baseline.totalSpent)
  assert.equal(metrics.suggestions[0].from, 'b')
  assert.equal(metrics.suggestions[0].to, 'a')
  assert.equal(metrics.suggestions[0].amount, 500)
  assert.equal(withAdvance.reduce((sum, entry) => sum + toMinorUnits(entry.net, 'INR'), 0), 0)
})

test('excess advance becomes a credit without being treated as an expense', () => {
  const advances = [
    { id: '1', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 250000 },
  ]
  const smaller = { ...expense, amount: 4000 }
  const balances = computeBalances({ trip, expenses: [smaller], advances })
  assert.equal(balances.find((entry) => entry.uid === 'b').remainingContribution, -500)
  assert.equal(balances.find((entry) => entry.uid === 'b').paid, 0)
  const suggestions = computeSettlementSuggestions(balances, 'INR')
  assert.equal(suggestions[0].from, 'a')
  assert.equal(suggestions[0].to, 'b')
  assert.equal(suggestions[0].amount, 500)
  assert.equal(buildDashboardMetrics({ trip, expenses: [smaller], advances }).totalSpent, 4000)
})

test('advances without expenses stay visible and do not create settlement suggestions', () => {
  const advances = [
    { id: '1', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 200000 },
  ]
  const balances = computeBalances({ trip, expenses: [], advances })
  assert.equal(balances.find((entry) => entry.uid === 'b').advance, 2000)
  assert.equal(balances.find((entry) => entry.uid === 'b').paid, 0)
  assert.deepEqual(computeSettlementSuggestions(balances, 'INR'), [])
})

test('a reversal keeps the original advance and removes it from the active total', () => {
  const advances = [
    { id: '1', status: 'reversed', memberUid: 'b', recordedBy: 'a', amountPaise: 50000, note: 'First' },
    { id: '1-reversal', status: 'reversal', reversalOf: '1', memberUid: 'b', recordedBy: 'a', amountPaise: 50000, note: 'Wrong amount' },
    { id: '2', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 100000 },
  ]
  assert.equal(summarizeAdvances({ members, advances }).contributed.get('b'), 100000)
  assert.equal(advances[0].amountPaise, 50000)
  assert.equal(advances[0].note, 'First')
  const balances = computeBalances({ trip, expenses: [expense], advances })
  assert.equal(balances.find((entry) => entry.uid === 'b').advance, 1000)
})

test('an edited advance keeps the original and counts only the replacement', () => {
  const advances = [
    { id: '1', status: 'reversed', memberUid: 'b', recordedBy: 'a', amountPaise: 50000 },
    { id: '1-reversal', status: 'reversal', reversalOf: '1', memberUid: 'b', recordedBy: 'a', amountPaise: 50000 },
    { id: '2', status: 'recorded', memberUid: 'b', recordedBy: 'a', amountPaise: 80000, replaces: '1' },
  ]
  assert.equal(summarizeAdvances({ members, advances }).contributed.get('b'), 80000)
  assert.equal(advances[0].amountPaise, 50000)
  const balances = computeBalances({ trip, expenses: [expense], advances })
  assert.equal(balances.find((entry) => entry.uid === 'b').advance, 800)
  assert.equal(balances.find((entry) => entry.uid === 'b').remainingContribution, 1700)
})

test('existing settlement math is unchanged when no advances are recorded', () => {
  const balances = computeBalances({
    trip: { currency: 'INR', members },
    expenses: [expense],
    settlements: [{ from: 'b', to: 'a', amount: 100 }],
  })
  assert.equal(balances.find((entry) => entry.uid === 'a').net, 2400)
  assert.equal(balances.find((entry) => entry.uid === 'b').settledOut, 100)
  assert.equal(balances.find((entry) => entry.uid === 'a').advance, 0)
})
