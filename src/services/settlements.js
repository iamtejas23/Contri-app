import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'

import { db } from '../firebase/config.js'
import { notifyFirebaseError } from '../lib/errors.js'
import { assertFinanciallyValid, validateSettlementForWrite } from '../lib/financialValidation.js'
import { runInFlightOnce, serializeOperation } from '../lib/inFlight.js'
import {
  buildCreateSettlementBatch,
  buildDeleteSettlementBatch,
  buildUpdateSettlementBatch,
} from './settlementWrites.js'
import { requestPushDelivery } from './pushDelivery.js'

export {
  buildCreateSettlementBatch,
  buildDeleteSettlementBatch,
  buildUpdateSettlementBatch,
} from './settlementWrites.js'

export const createSettlement = async ({ tripId, values, actor, memberIds, currency }) => {
  const operationKey = `settlement-create:${tripId}:${actor?.uid}:${serializeOperation({ values, currency })}`
  return runInFlightOnce(operationKey, async () => {
    try {
      assertFinanciallyValid(validateSettlementForWrite({ values, currency, memberIds }))
      const { batch, activityId } = buildCreateSettlementBatch({ database: db, tripId, values, actor, currency })
      await batch.commit()
      void requestPushDelivery({ tripId, eventId: activityId, eventType: 'settlement_created' })
    } catch (error) {
      notifyFirebaseError(error, 'We could not record that settlement.')
      throw error
    }
  })
}

export const updateSettlement = async ({ tripId, settlementId, values, actor, memberIds, currency }) => {
  const operationKey = `settlement-update:${tripId}:${settlementId}:${actor?.uid}:${serializeOperation({ values, currency })}`
  return runInFlightOnce(operationKey, async () => {
    try {
      assertFinanciallyValid(validateSettlementForWrite({ values, currency, memberIds }))
      const { batch, activityId } = buildUpdateSettlementBatch({ database: db, tripId, settlementId, values, actor, currency })
      await batch.commit()
      void requestPushDelivery({ tripId, eventId: activityId, eventType: 'settlement_updated' })
    } catch (error) {
      notifyFirebaseError(error, 'We could not update that settlement.')
      throw error
    }
  })
}

export const deleteSettlement = async ({ tripId, settlementId, actor }) => {
  const operationKey = `settlement-delete:${tripId}:${settlementId}:${actor?.uid}`
  return runInFlightOnce(operationKey, async () => {
    try {
      const settlementRef = doc(db, 'trips', tripId, 'settlements', settlementId)
      const snapshot = await getDoc(settlementRef)
      if (!snapshot.exists()) throw new Error('This settlement was already removed.')
      const { batch } = buildDeleteSettlementBatch({
        database: db,
        tripId,
        settlementId,
        settlement: snapshot.data(),
        actor,
      })
      await batch.commit()
    } catch (error) {
      notifyFirebaseError(error, 'We could not delete that settlement.')
      throw error
    }
  })
}

export const updateSettlementManagementPermission = async ({ tripId, memberUid, enabled, actorUid }) => {
  if (!tripId || !memberUid || !actorUid || typeof enabled !== 'boolean') {
    throw new Error('A trip, current admin, member and permission value are required.')
  }
  try {
    await runTransaction(db, async (transaction) => {
      const tripRef = doc(db, 'trips', tripId)
      const snapshot = await transaction.get(tripRef)
      if (!snapshot.exists()) throw new Error('Trip not found.')
      const trip = snapshot.data()
      const isAdmin = trip.createdBy === actorUid
        || (trip.memberIds?.includes(actorUid) && trip.adminIds?.includes(actorUid))
      if (!isAdmin) throw new Error('Only a trip admin can change settlement permissions.')
      if (!trip.memberIds?.includes(memberUid)) throw new Error('Settlement access can only be granted to a current trip member.')
      if (memberUid === trip.createdBy || trip.adminIds?.includes(memberUid)) {
        throw new Error('Trip admins already have settlement access.')
      }

      const current = Array.isArray(trip.settlementManagerIds) ? trip.settlementManagerIds : []
      const next = enabled
        ? [...new Set([...current, memberUid])]
        : current.filter((uid) => uid !== memberUid)
      transaction.update(tripRef, {
        settlementManagerIds: next,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    notifyFirebaseError(error, 'We could not update settlement permissions.')
    throw error
  }
}
