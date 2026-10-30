import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildExpenseCreationActivityMap } from '../src/lib/expenseCreators.js'
import { expenseCreationTime, sortExpensesNewestFirst } from '../src/lib/expenseSorting.js'

const time = (seconds) => ({ seconds, nanoseconds: 0 })

test('sorts expenses newest-first by creation timestamp, not expense date or amount', () => {
  const expenses = [
    { id: 'old', amount: 999, date: '2026-12-01', createdAt: time(100) },
    { id: 'new', amount: 1, date: '2020-01-01', createdAt: time(300) },
    { id: 'middle', amount: 50, date: '2026-11-01', createdAt: new Date(200_000) },
  ]
  assert.deepEqual(sortExpensesNewestFirst(expenses).map(({ id }) => id), ['new', 'middle', 'old'])
})

test('equal creation timestamps use stable document ID ordering', () => {
  assert.deepEqual(sortExpensesNewestFirst([
    { id: 'zeta', createdAt: time(100) },
    { id: 'alpha', createdAt: time(100) },
  ]).map(({ id }) => id), ['alpha', 'zeta'])
})

test('supports Date, ISO string, epoch seconds, and Firestore timestamp legacy shapes', () => {
  const expenses = [
    { id: 'seconds', createdAt: 1_700_000_000 },
    { id: 'date', createdAt: new Date('2024-01-01T00:00:00Z') },
    { id: 'string', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'legacy', createdAt: { _seconds: 1_800_000_000, _nanoseconds: 500_000_000 } },
  ]
  assert.deepEqual(sortExpensesNewestFirst(expenses).map(({ id }) => id), ['legacy', 'string', 'date', 'seconds'])
})

test('missing and invalid timestamps remain visible at the end in deterministic order', () => {
  const expenses = [
    { id: 'no-time' },
    { id: 'invalid', createdAt: 'not a date', updatedAt: '2030-01-01T00:00:00Z', date: '2035-01-01' },
    { id: 'known', createdAt: time(1) },
  ]
  assert.deepEqual(sortExpensesNewestFirst(expenses).map(({ id }) => id), ['known', 'invalid', 'no-time'])
  assert.equal(expenseCreationTime(expenses[1]), null)
})

test('legacy expenses use the matching expense-created activity timestamp', () => {
  const map = buildExpenseCreationActivityMap([
    { type: 'expense_created', actorUid: 'member', timestamp: time(20), meta: { expenseId: 'legacy-expense' } },
  ])
  const expenses = [
    { id: 'old', createdAt: time(10) },
    { id: 'legacy-expense' },
  ]
  assert.deepEqual(sortExpensesNewestFirst(expenses, map).map(({ id }) => id), ['legacy-expense', 'old'])
})

test('newly created expense is promoted to the top in subsequent real-time snapshots', () => {
  const initial = sortExpensesNewestFirst([
    { id: 'expense-a', createdAt: time(100) },
    { id: 'expense-b', createdAt: time(200) },
  ])
  const updatedSnapshot = sortExpensesNewestFirst([
    ...initial,
    { id: 'expense-c', createdAt: time(300) },
  ])
  assert.deepEqual(updatedSnapshot.map(({ id }) => id), ['expense-c', 'expense-b', 'expense-a'])
})

test('sorting a filtered subset preserves creation order', () => {
  const filteredPage = [
    { id: 'old-dinner', category: 'Food', createdAt: time(10) },
    { id: 'new-dinner', category: 'Food', createdAt: time(30) },
    { id: 'excluded', category: 'Travel', createdAt: time(40) },
  ].filter((expense) => expense.category === 'Food')
  assert.deepEqual(sortExpensesNewestFirst(filteredPage).map(({ id }) => id), ['new-dinner', 'old-dinner'])
})
