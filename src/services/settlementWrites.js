import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'

import { ACTIVITY_TYPES, createActivityPayload } from '../lib/activity.js'
import { fromMinorUnits, parseMinorUnits } from '../lib/money.js'
import { assertFinanciallyValid, validateSettlementForWrite } from '../lib/financialValidation.js'

export const buildCreateSettlementBatch = ({ database, tripId, values, actor, currency = 'INR' }) => {
  assertFinanciallyValid(validateSettlementForWrite({ values, currency }))
  const settlementRef = doc(collection(database, 'trips', tripId, 'settlements'))
  const activityRef = doc(collection(database, 'trips', tripId, 'activity'))
  const amount = fromMinorUnits(parseMinorUnits(values.amount, currency), currency)
  const batch = writeBatch(database)

  batch.set(settlementRef, {
    from: values.from,
    to: values.to,
    amount,
    method: values.method,
    settledAt: values.settledAt || serverTimestamp(),
    note: values.note?.trim() || '',
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
  })
  batch.set(
    activityRef,
    createActivityPayload({
      type: ACTIVITY_TYPES.SETTLEMENT_CREATED,
      actor,
      message: '{actor} recorded a settlement from {from} to {to} for {amount}.',
      meta: {
        from: values.from,
        to: values.to,
        amount,
        settlementId: settlementRef.id,
      },
    }),
  )

  return { batch, settlementId: settlementRef.id, activityId: activityRef.id }
}

export const buildUpdateSettlementBatch = ({ database, tripId, settlementId, values, actor, currency = 'INR' }) => {
  assertFinanciallyValid(validateSettlementForWrite({ values, currency }))
  const settlementRef = doc(database, 'trips', tripId, 'settlements', settlementId)
  const activityRef = doc(collection(database, 'trips', tripId, 'activity'))
  const amount = fromMinorUnits(parseMinorUnits(values.amount, currency), currency)
  const batch = writeBatch(database)

  batch.update(settlementRef, {
    from: values.from,
    to: values.to,
    amount,
    method: values.method,
    settledAt: values.settledAt,
    note: values.note?.trim() || '',
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  })
  batch.set(activityRef, createActivityPayload({
    type: ACTIVITY_TYPES.SETTLEMENT_UPDATED,
    actor,
    message: '{actor} updated a settlement from {from} to {to} for {amount}.',
    meta: { from: values.from, to: values.to, amount, settlementId },
  }))

  return { batch, settlementId, activityId: activityRef.id }
}

export const buildDeleteSettlementBatch = ({ database, tripId, settlementId, settlement, actor }) => {
  const settlementRef = doc(database, 'trips', tripId, 'settlements', settlementId)
  const activityRef = doc(collection(database, 'trips', tripId, 'activity'))
  const batch = writeBatch(database)

  batch.delete(settlementRef)
  batch.set(activityRef, createActivityPayload({
    type: ACTIVITY_TYPES.SETTLEMENT_DELETED,
    actor,
    message: '{actor} deleted a settlement from {from} to {to} for {amount}.',
    meta: {
      from: settlement.from,
      to: settlement.to,
      amount: settlement.amount,
      settlementId,
    },
  }))

  return { batch, activityId: activityRef.id }
}
