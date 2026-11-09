import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../firebase/config'
import { ACTIVITY_TYPES, createActivityPayload } from '../lib/activity'
import { notifyFirebaseError } from '../lib/errors'
import { fromMinorUnits, parseMinorUnits } from '../lib/money.js'
import { assertFinanciallyValid, validateExpenseForWrite } from '../lib/financialValidation.js'
import { runInFlightOnce, serializeOperation } from '../lib/inFlight.js'
import { buildCreateExpenseBatch } from './expenseWrites'
import { requestPushDelivery } from './pushDelivery'

const buildExpensePayload = ({
  values,
  existingExpense,
  currency = 'INR',
}) => {
  assertFinanciallyValid(validateExpenseForWrite({ values, currency }))
  const receiptURL = Object.hasOwn(values, 'receiptURL')
    ? values.receiptURL.trim()
    : existingExpense?.receiptURL || ''

  return {
    title: values.title.trim(),
    amount: fromMinorUnits(parseMinorUnits(values.amount, currency), currency),
    category: values.category,
    paidBy: values.paidBy,
    date: values.date,
    note: (values.note || '').trim(),
    splitMode: values.splitMode,
    splitAmong: values.splitAmong,
    receiptURL,
    updatedAt: serverTimestamp(),
  }
}

export const createExpense = async ({ tripId, tripName, memberIds, currency, values, actor }) => {
  const operationKey = `expense-create:${tripId}:${actor?.uid}:${serializeOperation({ values, currency })}`
  return runInFlightOnce(operationKey, async () => {
    try {
      assertFinanciallyValid(validateExpenseForWrite({ values, currency, memberIds }))
      const { batch, activityId } = buildCreateExpenseBatch({ database: db, tripId, tripName, memberIds, currency, values, actor })
      await batch.commit()
      void requestPushDelivery({ tripId, eventId: activityId, eventType: 'expense_created' })
    } catch (error) {
      notifyFirebaseError(error, 'We could not save that expense.')
      throw error
    }
  })
}

export const updateExpense = async ({ tripId, expenseId, values, actor, existingExpense, memberIds, currency }) => {
  const operationKey = `expense-update:${tripId}:${expenseId}:${serializeOperation({ values, currency })}`
  return runInFlightOnce(operationKey, async () => {
    try {
      assertFinanciallyValid(validateExpenseForWrite({ values, currency, memberIds }))
      const payload = buildExpensePayload({ values, existingExpense, currency })
      payload.updatedBy = actor.uid
      const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
      const batch = writeBatch(db)
      batch.set(doc(db, 'trips', tripId, 'expenses', expenseId), payload, { merge: true })
      batch.set(activityRef, createActivityPayload({
        type: ACTIVITY_TYPES.EXPENSE_UPDATED,
        actor,
        message: '{actor} updated {title}.',
        meta: { title: payload.title, amount: payload.amount, expenseId },
      }))
      await batch.commit()
      void requestPushDelivery({ tripId, eventId: activityRef.id, eventType: 'expense_updated' })
    } catch (error) {
      notifyFirebaseError(error, 'We could not update that expense.')
      throw error
    }
  })
}

export const deleteExpense = async ({ tripId, expense, actor }) => {
  const operationKey = `expense-delete:${tripId}:${expense.id}`
  return runInFlightOnce(operationKey, async () => {
    try {
      const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
      const batch = writeBatch(db)
      batch.delete(doc(db, 'trips', tripId, 'expenses', expense.id))
      batch.set(activityRef, createActivityPayload({
        type: ACTIVITY_TYPES.EXPENSE_DELETED,
        actor,
        message: '{actor} deleted {title}.',
        meta: { title: expense.title, amount: expense.amount, expenseId: expense.id },
      }))
      await batch.commit()
    } catch (error) {
      notifyFirebaseError(error, 'We could not delete that expense.')
      throw error
    }
  })
}
