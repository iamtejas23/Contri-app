import { db } from '../firebase/config.js'
import { notifyFirebaseError } from '../lib/errors.js'
import {
  recordTripAdvanceInDatabase,
  replaceTripAdvanceInDatabase,
  reverseTripAdvanceInDatabase,
} from './advanceWrites.js'

export {
  recordTripAdvanceInDatabase,
  replaceTripAdvanceInDatabase,
  reverseTripAdvanceInDatabase,
} from './advanceWrites.js'

export const recordTripAdvance = async ({ tripId, actorUid, memberIds, currency, values }) => {
  try {
    return await recordTripAdvanceInDatabase({
      database: db, tripId, actorUid, memberIds, currency, values,
    })
  } catch (error) {
    notifyFirebaseError(error, 'The advance contribution was not recorded.')
    throw error
  }
}

export const reverseTripAdvance = async ({ tripId, actorUid, advance, note = '' }) => {
  try {
    return await reverseTripAdvanceInDatabase({ database: db, tripId, actorUid, advance, note })
  } catch (error) {
    notifyFirebaseError(error, 'The advance correction was not saved.')
    throw error
  }
}

export const replaceTripAdvance = async ({ tripId, actorUid, advance, memberIds, currency, values }) => {
  try {
    return await replaceTripAdvanceInDatabase({
      database: db, tripId, actorUid, advance, memberIds, currency, values,
    })
  } catch (error) {
    notifyFirebaseError(error, 'The advance contribution was not updated.')
    throw error
  }
}
