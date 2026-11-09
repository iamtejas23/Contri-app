import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'

const LOCK_LEASE_MS = 5 * 60 * 1000
const WRITE_BATCH_SIZE = 400
const RECORD_COLLECTIONS = ['expenses', 'settlements', 'activity', 'advances']

const makeOperationId = () => globalThis.crypto?.randomUUID?.()
  || `clear-${Date.now()}-${Math.random().toString(36).slice(2)}`

const timestampMillis = (value) => {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number.NaN
}

export const acquireTripClearLock = async ({ database, tripId, uid, operationId = makeOperationId() }) => {
  if (!tripId || !uid) throw new Error('A signed-in trip admin is required.')

  const tripRef = doc(database, 'trips', tripId)
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(tripRef)
    if (!snapshot.exists()) throw new Error('This trip no longer exists.')

    const trip = snapshot.data()
    const lock = trip.clearOperation
    if (lock) {
      const isExpired = Date.now() - timestampMillis(lock.lockedAt) > LOCK_LEASE_MS
      if (!isExpired) {
        throw new Error('Another admin is already clearing this trip. Try again after that operation finishes.')
      }
    }

    transaction.update(tripRef, {
      clearOperation: { ownerUid: uid, operationId, lockedAt: serverTimestamp() },
    })
  })

  return { operationId, tripRef }
}

const refreshTripClearLock = async ({ database, tripRef, uid, operationId }) => {
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(tripRef)
    const lock = snapshot.data()?.clearOperation
    if (!snapshot.exists() || lock?.ownerUid !== uid || lock?.operationId !== operationId) {
      throw new Error('The clear operation lock expired or was replaced. No success was reported.')
    }
    transaction.update(tripRef, {
      clearOperation: { ownerUid: uid, operationId, lockedAt: serverTimestamp() },
    })
  })
}

export const releaseTripClearLock = async ({ database, tripRef, uid, operationId }) => {
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(tripRef)
    const lock = snapshot.data()?.clearOperation
    if (snapshot.exists() && lock?.ownerUid === uid && lock?.operationId === operationId) {
      transaction.update(tripRef, { clearOperation: deleteField() })
    }
  })
}

const getTripRecords = async ({ database, tripId }) => {
  const snapshots = await Promise.all(RECORD_COLLECTIONS.map((name) =>
    getDocs(collection(database, 'trips', tripId, name)),
  ))
  return snapshots.flatMap((snapshot) => snapshot.docs)
}

const getTripNotifications = async ({ database, tripId, memberUids }) => {
  const snapshots = await Promise.all([...memberUids].map((uid) =>
    getDocs(query(
      collection(database, 'users', uid, 'notifications'),
      where('tripId', '==', tripId),
    )),
  ))
  return snapshots.flatMap((snapshot) => snapshot.docs)
}

const deleteInChunks = async ({ database, documents, commitBatch, onBatch }) => {
  let deletedCount = 0
  for (let index = 0; index < documents.length; index += WRITE_BATCH_SIZE) {
    const batch = writeBatch(database)
    documents.slice(index, index + WRITE_BATCH_SIZE).forEach((item) => batch.delete(item.ref))
    await commitBatch(batch)
    deletedCount += Math.min(WRITE_BATCH_SIZE, documents.length - index)
    await onBatch()
  }
  return deletedCount
}

/**
 * Removes only trip-scoped expense, settlement, activity, advance and notification documents.
 * The trip and its membership/settings are held behind a short-lived Firestore lock,
 * preventing concurrent clear runs and new financial writes during the operation.
 */
export const clearTripDataFromDatabase = async ({
  database,
  tripId,
  uid,
  operationId = makeOperationId(),
  commitBatch = (batch) => batch.commit(),
}) => {
  const { tripRef } = await acquireTripClearLock({ database, tripId, uid, operationId })
  let didReleaseLock = false
  const refreshLock = () => refreshTripClearLock({ database, tripRef, uid, operationId })

  try {
    const tripSnapshot = await getDoc(tripRef)
    if (!tripSnapshot.exists()) throw new Error('This trip no longer exists.')
    const trip = tripSnapshot.data()
    const memberUids = new Set([
      ...(Array.isArray(trip.memberIds) ? trip.memberIds : []),
      ...(typeof trip.createdBy === 'string' ? [trip.createdBy] : []),
    ].filter((memberUid) => typeof memberUid === 'string' && memberUid))

    const [tripRecords, tripNotifications] = await Promise.all([
      getTripRecords({ database, tripId }),
      getTripNotifications({ database, tripId, memberUids }),
    ])
    const documents = [...tripRecords, ...tripNotifications]
    const deletedCount = await deleteInChunks({
      database,
      documents,
      commitBatch,
      onBatch: refreshLock,
    })

    const remaining = await Promise.all([
      getTripRecords({ database, tripId }),
      getTripNotifications({ database, tripId, memberUids }),
    ])
    const remainingCount = remaining.reduce((count, records) => count + records.length, 0)
    if (remainingCount > 0) {
      throw new Error(`Clear incomplete: ${remainingCount} trip record(s) remain. Retry to finish safely.`)
    }

    await releaseTripClearLock({ database, tripRef, uid, operationId })
    didReleaseLock = true
    return {
      deletedCount,
      collections: [...RECORD_COLLECTIONS, 'member notification documents'],
    }
  } catch (error) {
    let failure = error instanceof Error ? error : new Error('Trip data could not be fully cleared.')
    if (!didReleaseLock) {
      try {
        await releaseTripClearLock({ database, tripRef, uid, operationId })
        didReleaseLock = true
      } catch {
        failure = new Error(
          `${failure.message} The clear lock could not be released; it expires after five minutes and can then be retried.`,
          { cause: failure },
        )
      }
    }
    failure.clearIncomplete = true
    throw failure
  }
}

export const tripClearBatchSize = WRITE_BATCH_SIZE
