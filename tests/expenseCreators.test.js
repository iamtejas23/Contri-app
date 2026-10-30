import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildExpenseCreationActivityMap,
  resolveExpenseCreator,
} from '../src/lib/expenseCreators.js'

test('expense creator resolves from the saved createdBy UID and current trip member', () => {
  const result = resolveExpenseCreator(
    { id: 'expense-1', createdBy: 'member-1', paidBy: 'member-2' },
    {
      'member-1': { uid: 'member-1', name: 'Asha', photoURL: 'https://example.test/asha.jpg' },
      'member-2': { uid: 'member-2', name: 'Ravi' },
    },
  )

  assert.deepEqual(result, {
    uid: 'member-1',
    name: 'Asha',
    photoURL: 'https://example.test/asha.jpg',
  })
})

test('legacy expense creator resolves from its matching expense-created activity record', () => {
  const activityMap = buildExpenseCreationActivityMap([
    { id: 'unrelated', type: 'expense_created', actorUid: 'other', meta: { expenseId: 'other-expense' } },
    { id: 'created', type: 'expense_created', actorUid: 'creator-1', actorName: 'Mina', meta: { expenseId: 'expense-1' } },
    { id: 'settlement', type: 'settlement_created', actorUid: 'settler', meta: { expenseId: 'expense-1' } },
  ])

  assert.equal(Object.keys(activityMap).length, 2)
  assert.deepEqual(resolveExpenseCreator({ id: 'expense-1', paidBy: 'payer-1' }, {}, activityMap), {
    uid: 'creator-1',
    name: 'Mina',
    photoURL: '',
  })
})

test('creator fallback never mistakes the expense payer for its author', () => {
  assert.deepEqual(resolveExpenseCreator({ id: 'legacy-expense', paidBy: 'payer-1' }), {
    uid: '',
    name: 'Unknown member',
    photoURL: '',
  })
})

test('conflicting legacy creation actors fall back safely instead of guessing', () => {
  const activityMap = buildExpenseCreationActivityMap([
    { type: 'expense_created', actorUid: 'creator-1', actorName: 'Mina', meta: { expenseId: 'expense-1' } },
    { type: 'expense_created', actorUid: 'creator-2', actorName: 'Asha', meta: { expenseId: 'expense-1' } },
  ])

  assert.deepEqual(resolveExpenseCreator({ id: 'expense-1', paidBy: 'payer-1' }, {}, activityMap), {
    uid: '',
    name: 'Unknown member',
    photoURL: '',
  })
})
