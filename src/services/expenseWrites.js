import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'

import { ACTIVITY_TYPES, createActivityPayload } from '../lib/activity.js'
import { buildExpenseNotification, expenseNotificationId } from '../lib/notifications.js'
import { roundCurrency, toNumber } from '../lib/utils.js'

const buildExpensePayload = ({ values, actor, existingExpense }) => {
  const receiptURL = Object.hasOwn(values, 'receiptURL')
    ? values.receiptURL.trim()
    : existingExpense?.receiptURL || ''

  return {
    title: values.title.trim(),
    amount: roundCurrency(toNumber(values.amount)),
    category: values.category,
    paidBy: values.paidBy,
    date: values.date,
    note: (values.note || '').trim(),
    splitMode: values.splitMode,
    splitAmong: values.splitAmong,
    receiptURL,
    ...(actor ? { createdBy: actor.uid } : {}),
    updatedAt: serverTimestamp(),
  }
}

export const buildCreateExpenseBatch = ({
  database,
  tripId,
  tripName,
  memberIds,
  currency,
  values,
  actor,
}) => {
  const expenseRef = doc(collection(database, 'trips', tripId, 'expenses'))
  const activityRef = doc(collection(database, 'trips', tripId, 'activity'))
  const payload = buildExpensePayload({ values, actor })
  const batch = writeBatch(database)

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

  const recipients = [...new Set(memberIds || [])].filter(Boolean)
  recipients.forEach((recipientUid) => {
    const notification = buildExpenseNotification({
      tripId,
      tripName,
      expenseId: expenseRef.id,
      recipientUid,
      actor,
      expense: { ...payload, currency },
    })
    const notificationRef = doc(
      database,
      'users',
      recipientUid,
      'notifications',
      expenseNotificationId(tripId, expenseRef.id),
    )
    batch.set(notificationRef, {
      ...notification,
      createdAt: serverTimestamp(),
    })
  })

  return { batch, expenseId: expenseRef.id, activityId: activityRef.id }
}
