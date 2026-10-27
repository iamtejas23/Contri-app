import { db } from '../firebase/config.js'
import { notifyFirebaseError } from '../lib/errors.js'
import { buildCreateSettlementBatch } from './settlementWrites.js'

export { buildCreateSettlementBatch } from './settlementWrites.js'

export const createSettlement = async ({ tripId, values, actor }) => {
  try {
    const { batch } = buildCreateSettlementBatch({ database: db, tripId, values, actor })

    await batch.commit()
  } catch (error) {
    notifyFirebaseError(error, 'We could not record that settlement.')
    throw error
  }
}
