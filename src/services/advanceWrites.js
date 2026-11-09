import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

import { isActiveRecordedAdvance, validateAdvanceInput } from '../lib/advances.js'

const requireAdminActor = ({ tripId, actorUid }) => {
  if (!tripId || !actorUid) throw new Error('A signed-in trip admin is required.')
}

const requireActiveAdvance = (advance) => {
  if (!advance?.id || !isActiveRecordedAdvance(advance, [advance])) {
    throw new Error('This contribution can no longer be corrected.')
  }
}

const reversalPayload = ({ tripId, actorUid, advance, note }) => ({
  tripId,
  memberUid: advance.memberUid,
  amountPaise: advance.amountPaise,
  recordedBy: actorUid,
  paymentDate: advance.paymentDate,
  createdAt: serverTimestamp(),
  reference: '',
  note: String(note || '').trim().slice(0, 280),
  status: 'reversal',
  reversalOf: advance.id,
  replaces: '',
})

const recordedPayload = ({ tripId, actorUid, value, replaces = '' }) => ({
  tripId,
  memberUid: value.memberUid,
  amountPaise: value.amountPaise,
  recordedBy: actorUid,
  paymentDate: value.paymentDate,
  createdAt: serverTimestamp(),
  reference: value.reference,
  note: value.note,
  status: 'recorded',
  reversalOf: '',
  replaces,
})

export const recordTripAdvanceInDatabase = async ({ database, tripId, actorUid, memberIds, currency, values }) => {
  requireAdminActor({ tripId, actorUid })
  const validated = validateAdvanceInput({ ...values, memberIds, currency })
  if (!validated.valid) throw new Error(validated.error)
  const advanceRef = doc(collection(database, 'trips', tripId, 'advances'))
  await runTransaction(database, async (transaction) => {
    transaction.set(advanceRef, recordedPayload({ tripId, actorUid, value: validated.value }))
  })
  return advanceRef.id
}

export const reverseTripAdvanceInDatabase = async ({ database, tripId, actorUid, advance, note = '' }) => {
  requireAdminActor({ tripId, actorUid })
  requireActiveAdvance(advance)
  const originalRef = doc(database, 'trips', tripId, 'advances', advance.id)
  const reversalRef = doc(collection(database, 'trips', tripId, 'advances'))
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(originalRef)
    if (!snapshot.exists() || snapshot.data().status !== 'recorded' || snapshot.data().reversalId) {
      throw new Error('This contribution can no longer be corrected.')
    }
    transaction.update(originalRef, {
      status: 'reversed',
      reversalId: reversalRef.id,
      reversedAt: serverTimestamp(),
    })
    transaction.set(reversalRef, reversalPayload({ tripId, actorUid, advance: { ...advance, ...snapshot.data(), id: advance.id }, note }))
  })
  return reversalRef.id
}

export const replaceTripAdvanceInDatabase = async ({
  database,
  tripId,
  actorUid,
  advance,
  memberIds,
  currency,
  values,
}) => {
  requireAdminActor({ tripId, actorUid })
  requireActiveAdvance(advance)
  const validated = validateAdvanceInput({ ...values, memberIds, currency })
  if (!validated.valid) throw new Error(validated.error)
  const originalRef = doc(database, 'trips', tripId, 'advances', advance.id)
  const reversalRef = doc(collection(database, 'trips', tripId, 'advances'))
  const replacementRef = doc(collection(database, 'trips', tripId, 'advances'))
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(originalRef)
    if (!snapshot.exists() || snapshot.data().status !== 'recorded' || snapshot.data().reversalId) {
      throw new Error('This contribution can no longer be corrected.')
    }
    const current = { ...advance, ...snapshot.data(), id: advance.id }
    transaction.update(originalRef, {
      status: 'reversed',
      reversalId: reversalRef.id,
      reversedAt: serverTimestamp(),
    })
    transaction.set(reversalRef, reversalPayload({ tripId, actorUid, advance: current, note: 'Corrected by trip admin' }))
    transaction.set(replacementRef, recordedPayload({
      tripId,
      actorUid,
      value: validated.value,
      replaces: advance.id,
    }))
  })
  return replacementRef.id
}
