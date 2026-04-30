import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../firebase/config'
import { ACTIVITY_TYPES, createActivityPayload } from '../lib/activity'
import { notifyFirebaseError } from '../lib/errors'
import { roundCurrency, toNumber } from '../lib/utils'

const buildExpensePayload = async ({
  values,
  existingExpense,
}) => {
  const receiptURL = Object.hasOwn(values, 'receiptURL')
    ? values.receiptURL.trim()
    : existingExpense?.receiptURL || ''

  return {
    title: values.title.trim(),
    amount: roundCurrency(toNumber(values.amount)),
    category: values.category,
    paidBy: values.paidBy,
    date: values.date,
    note: values.note.trim(),
    splitMode: values.splitMode,
    splitAmong: values.splitAmong,
    receiptURL,
    updatedAt: serverTimestamp(),
  }
}

export const createExpense = async ({ tripId, values, actor }) => {
  try {
    const expenseRef = doc(collection(db, 'trips', tripId, 'expenses'))
    const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
    const payload = await buildExpensePayload({
      values,
    })

    const batch = writeBatch(db)
    batch.set(expenseRef, {
      ...payload,
      createdAt: serverTimestamp(),
    })
    batch.set(
      activityRef,
      createActivityPayload({
        type: ACTIVITY_TYPES.EXPENSE_CREATED,
        actor,
        message: '{actor} added {title} for {amount}.',
        meta: {
          title: payload.title,
          amount: payload.amount,
          expenseId: expenseRef.id,
        },
      }),
    )

    await batch.commit()
  } catch (error) {
    notifyFirebaseError(error, 'We could not save that expense.')
    throw error
  }
}

export const updateExpense = async ({ tripId, expenseId, values, actor, existingExpense }) => {
  try {
    const payload = await buildExpensePayload({
      values,
      existingExpense,
    })
    const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
    const batch = writeBatch(db)

    batch.set(doc(db, 'trips', tripId, 'expenses', expenseId), payload, { merge: true })
    batch.set(
      activityRef,
      createActivityPayload({
        type: ACTIVITY_TYPES.EXPENSE_UPDATED,
        actor,
        message: '{actor} updated {title}.',
        meta: {
          title: payload.title,
          amount: payload.amount,
          expenseId,
        },
      }),
    )

    await batch.commit()
  } catch (error) {
    notifyFirebaseError(error, 'We could not update that expense.')
    throw error
  }
}

export const deleteExpense = async ({ tripId, expense, actor }) => {
  try {
    const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
    const batch = writeBatch(db)

    batch.delete(doc(db, 'trips', tripId, 'expenses', expense.id))
    batch.set(
      activityRef,
      createActivityPayload({
        type: ACTIVITY_TYPES.EXPENSE_DELETED,
        actor,
        message: '{actor} deleted {title}.',
        meta: {
          title: expense.title,
          amount: expense.amount,
          expenseId: expense.id,
        },
      }),
    )

    await batch.commit()
  } catch (error) {
    notifyFirebaseError(error, 'We could not delete that expense.')
    throw error
  }
}
