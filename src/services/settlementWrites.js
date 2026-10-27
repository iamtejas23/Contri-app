import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'

import { ACTIVITY_TYPES, createActivityPayload } from '../lib/activity.js'
import { roundCurrency, toNumber } from '../lib/utils.js'

export const buildCreateSettlementBatch = ({ database, tripId, values, actor }) => {
  const settlementRef = doc(collection(database, 'trips', tripId, 'settlements'))
  const activityRef = doc(collection(database, 'trips', tripId, 'activity'))
  const amount = roundCurrency(toNumber(values.amount))
  const batch = writeBatch(database)

  batch.set(settlementRef, {
    from: values.from,
    to: values.to,
    amount,
    method: values.method,
    settledAt: values.settledAt || serverTimestamp(),
    note: values.note?.trim() || '',
    createdBy: actor.uid,
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
