import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'

import { db } from '../firebase/config'
import { ACTIVITY_TYPES, createActivityPayload } from '../lib/activity'
import { notifyFirebaseError } from '../lib/errors'
import { roundCurrency, toNumber } from '../lib/utils'

export const createSettlement = async ({ tripId, values, actor }) => {
  try {
    const settlementRef = doc(collection(db, 'trips', tripId, 'settlements'))
    const activityRef = doc(collection(db, 'trips', tripId, 'activity'))
    const amount = roundCurrency(toNumber(values.amount))
    const batch = writeBatch(db)

    batch.set(settlementRef, {
      from: values.from,
      to: values.to,
      amount,
      method: values.method,
      settledAt: values.settledAt || serverTimestamp(),
      note: values.note?.trim() || '',
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

    await batch.commit()
  } catch (error) {
    notifyFirebaseError(error, 'We could not record that settlement.')
    throw error
  }
}
