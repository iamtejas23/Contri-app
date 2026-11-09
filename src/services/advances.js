import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../firebase/config.js'
import { validateAdvanceInput } from '../lib/advances.js'
import { notifyFirebaseError } from '../lib/errors.js'

export const recordTripAdvance = async ({ tripId, actorUid, memberIds, currency, values }) => {
  const validated = validateAdvanceInput({ ...values, memberIds, currency })
  if (!validated.valid) throw new Error(validated.error)
  if (!tripId || !actorUid) throw new Error('A signed-in trip admin is required.')
  try {
    const batch = writeBatch(db)
    const advanceRef = doc(collection(db, 'trips', tripId, 'advances'))
    batch.set(advanceRef, {
      tripId,
      memberUid: validated.value.memberUid,
      amountPaise: validated.value.amountPaise,
      recordedBy: actorUid,
      paymentDate: validated.value.paymentDate,
      createdAt: serverTimestamp(),
      reference: validated.value.reference,
      note: validated.value.note,
      status: 'recorded',
      reversalOf: '',
    })
    await batch.commit()
    return advanceRef.id
  } catch (error) {
    notifyFirebaseError(error, 'The advance contribution was not recorded.')
    throw error
  }
}

export const reverseTripAdvance = async ({ tripId, actorUid, advance, note = '' }) => {
  if (!tripId || !actorUid || !advance?.id || advance.status !== 'recorded') {
    throw new Error('This contribution can no longer be corrected.')
  }
  const safeNote = String(note || '').trim().slice(0, 280)
  try {
    const reversalRef = doc(collection(db, 'trips', tripId, 'advances'))
    const originalRef = doc(db, 'trips', tripId, 'advances', advance.id)
    const batch = writeBatch(db)
    batch.update(originalRef, {
      status: 'reversed',
      reversalId: reversalRef.id,
      reversedAt: serverTimestamp(),
    })
    batch.set(reversalRef, {
      tripId,
      memberUid: advance.memberUid,
      amountPaise: advance.amountPaise,
      recordedBy: actorUid,
      paymentDate: advance.paymentDate,
      createdAt: serverTimestamp(),
      reference: '',
      note: safeNote,
      status: 'reversal',
      reversalOf: advance.id,
    })
    await batch.commit()
    return reversalRef.id
  } catch (error) {
    notifyFirebaseError(error, 'The advance correction was not saved.')
    throw error
  }
}
