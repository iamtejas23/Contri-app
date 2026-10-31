import { db } from '../firebase/config.js'
import { notifyFirebaseError } from '../lib/errors.js'
import { assertFinanciallyValid, validateSettlementForWrite } from '../lib/financialValidation.js'
import { runInFlightOnce, serializeOperation } from '../lib/inFlight.js'
import { buildCreateSettlementBatch } from './settlementWrites.js'

export { buildCreateSettlementBatch } from './settlementWrites.js'

export const createSettlement = async ({ tripId, values, actor, memberIds, currency }) => {
  const operationKey = `settlement-create:${tripId}:${actor?.uid}:${serializeOperation({ values, currency })}`
  return runInFlightOnce(operationKey, async () => {
    try {
      assertFinanciallyValid(validateSettlementForWrite({ values, currency, memberIds }))
      const { batch } = buildCreateSettlementBatch({ database: db, tripId, values, actor, currency })
      await batch.commit()
    } catch (error) {
      notifyFirebaseError(error, 'We could not record that settlement.')
      throw error
    }
  })
}
