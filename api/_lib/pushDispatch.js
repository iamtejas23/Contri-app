import { createHash } from 'node:crypto'

import { getFirebaseAdminServices } from './firebaseAdmin.js'

const EVENT_CONFIG = {
  expense_created: { kind: 'expense', collection: 'expenses', actorField: 'createdBy', destination: 'expenses', activityType: 'expense_created', targetField: 'expenseId' },
  expense_updated: { kind: 'expense', collection: 'expenses', actorField: 'updatedBy', destination: 'expenses', activityType: 'expense_updated', targetField: 'expenseId' },
  settlement_created: { kind: 'settlement', collection: 'settlements', actorField: 'createdBy', destination: 'settlements', activityType: 'settlement_created', targetField: 'settlementId' },
  settlement_updated: { kind: 'settlement', collection: 'settlements', actorField: 'updatedBy', destination: 'settlements', activityType: 'settlement_updated', targetField: 'settlementId' },
  advance_recorded: { kind: 'advance', collection: 'advances', actorField: 'recordedBy', destination: 'activity' },
  trip_member_added: { kind: 'trip-invite', collection: 'activity', destination: 'overview' },
}

const sendJson = (res, statusCode, body) => {
  res.setHeader?.('Cache-Control', 'no-store')
  return res.status(statusCode).json(body)
}

const safeFailure = (res, statusCode, code, message, stage, extra = {}) => {
  console.warn('[push-dispatch]', { code, stage, statusCode, ...extra })
  return sendJson(res, statusCode, { error: code, message })
}

const applyCors = (req, res) => {
  const origin = req.headers?.origin
  const allowed = (globalThis.process?.env?.PUSH_ALLOWED_ORIGINS || 'https://contri-app.vercel.app,https://localhost,http://localhost,capacitor://localhost')
    .split(',').map((value) => value.trim()).filter(Boolean)
  if (!origin) return true
  if (!allowed.includes(origin)) return false
  res.setHeader?.('Access-Control-Allow-Origin', origin)
  res.setHeader?.('Vary', 'Origin')
  res.setHeader?.('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader?.('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader?.('Access-Control-Max-Age', '600')
  return true
}

const getBearerToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+([^\s]+)$/i.exec(header)
  return match?.[1] || ''
}

const safeId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1500 && !value.includes('/')

const isFreshEvent = (timestamp) => {
  const milliseconds = typeof timestamp?.toMillis === 'function'
    ? timestamp.toMillis()
    : timestamp instanceof Date ? timestamp.getTime() : Number.NaN
  const age = Date.now() - milliseconds
  return Number.isFinite(age) && age >= -60_000 && age <= 15 * 60_000
}

const timestampsMatch = (left, right) => {
  const leftId = timestampId(left)
  return Boolean(leftId && leftId === timestampId(right))
}

const timestampId = (timestamp) => typeof timestamp?.toMillis === 'function'
  ? String(timestamp.toMillis())
  : timestamp instanceof Date ? String(timestamp.getTime()) : ''

const validatePersistedEvent = async ({ firestore, tripId, eventId, eventType, uid, trip }) => {
  const config = EVENT_CONFIG[eventType]
  if (!config) return null

  const members = getCurrentMemberIds(trip)

  if (eventType === 'trip_member_added' || config.activityType) {
    const activitySnapshot = await firestore.collection('trips').doc(tripId).collection('activity').doc(eventId).get()
    if (!activitySnapshot.exists) return null
    const activity = activitySnapshot.data()
    if (activity.type !== (config.activityType || eventType) || activity.actorUid !== uid || !isFreshEvent(activity.timestamp)) return null
    if (eventType === 'trip_member_added') {
      const targetUid = activity.meta?.targetUid
      const isAdmin = trip.createdBy === uid || (Array.isArray(trip.adminIds) && trip.adminIds.includes(uid))
      if (!isAdmin || !members.includes(targetUid) || targetUid === uid || !timestampsMatch(activity.timestamp, trip.updatedAt)) return null
      return { destination: config.destination, recordId: eventId, targetUid, dedupeId: `member:${targetUid}` }
    }
    const targetId = activity.meta?.[config.targetField]
    if (!safeId(targetId)) return null
    const targetSnapshot = await firestore.collection('trips').doc(tripId)
      .collection(config.collection).doc(targetId).get()
    if (!targetSnapshot.exists || targetSnapshot.data()[config.actorField] !== uid) return null
    const record = targetSnapshot.data()
    const sourceTimestamp = eventType.endsWith('_updated') ? record.updatedAt : record.createdAt
    if (!isFreshEvent(sourceTimestamp) || !timestampsMatch(activity.timestamp, sourceTimestamp)) return null
    return {
      destination: config.destination,
      recordId: targetId,
      dedupeId: `${targetId}:${timestampId(sourceTimestamp)}`,
    }
  }

  const ref = firestore.collection('trips').doc(tripId).collection(config.collection).doc(eventId)
  const snapshot = await ref.get()
  if (!snapshot.exists) return null
  const record = snapshot.data()

  if (config.kind === 'expense') {
    if (record.createdBy !== uid || !members.includes(record.paidBy) || !isFreshEvent(record.createdAt)) return null
    if (!Array.isArray(record.splitAmong) || record.splitAmong.some((member) => !members.includes(member?.uid))) return null
    return { destination: config.destination, recordId: eventId, dedupeId: eventId }
  }
  if (config.kind === 'settlement') {
    if (record.createdBy !== uid || !members.includes(record.from) || !members.includes(record.to) || !isFreshEvent(record.createdAt)) return null
    return { destination: config.destination, recordId: eventId, dedupeId: eventId }
  }
  if (record.recordedBy !== uid || record.status !== 'recorded') return null
  if (record.tripId !== tripId || !members.includes(record.memberUid)) return null
  if (!isFreshEvent(record.createdAt)) return null
  return { destination: config.destination, recordId: eventId, dedupeId: eventId }
}

const getCurrentMemberIds = (trip) => [...new Set([
  ...(Array.isArray(trip.memberIds) ? trip.memberIds : []),
  ...(Array.isArray(trip.members) ? trip.members.map((member) => member?.uid) : []),
  trip.createdBy,
].filter((uid) => typeof uid === 'string' && uid))]

export const createPushDispatchHandler = ({ getServices = getFirebaseAdminServices } = {}) => async (req, res) => {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'ORIGIN_NOT_ALLOWED', message: 'This app origin is not allowed.' })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST')
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST for push delivery.' })
  }

  const authorization = req.headers?.authorization || req.headers?.Authorization || ''
  const idToken = getBearerToken(req)
  if (!idToken) {
    const hasHeader = typeof authorization === 'string' && authorization.length > 0
    return safeFailure(res, 401, hasHeader ? 'AUTH_HEADER_MALFORMED' : 'AUTH_REQUIRED', 'Sign in before requesting push delivery.', 'auth_header')
  }

  const body = req.body || {}
  const { tripId, eventId, eventType } = body
  if (!safeId(tripId) || !safeId(eventId) || !EVENT_CONFIG[eventType]) {
    return safeFailure(res, 400, 'EVENT_INVALID', 'This trip update could not be verified.', 'request_validation')
  }

  let services
  let identity
  try {
    services = getServices()
    identity = await services.auth.verifyIdToken(idToken, true)
    if (identity.aud !== services.projectId || identity.iss !== `https://securetoken.google.com/${services.projectId}`) {
      return safeFailure(res, 401, 'AUTH_PROJECT_MISMATCH', 'This session belongs to a different Contri project.', 'token_validation')
    }
    if (identity.firebase?.sign_in_provider === 'anonymous') {
      return safeFailure(res, 403, 'GUEST_PUSH_DISABLED', 'Guest accounts do not receive push notifications.', 'token_validation')
    }
  } catch (error) {
    const serverConfigCodes = new Set(['PUSH_SERVER_CONFIG_MISSING', 'PUSH_SERVER_CONFIG_INVALID', 'PUSH_PROJECT_CONFIG_MISMATCH'])
    const code = error?.code === 'auth/id-token-expired' ? 'AUTH_TOKEN_EXPIRED'
      : error?.code?.startsWith?.('auth/') ? 'AUTH_TOKEN_INVALID'
        : serverConfigCodes.has(error?.code) ? error.code : 'AUTH_VERIFICATION_UNAVAILABLE'
    const status = code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_TOKEN_INVALID' ? 401 : 503
    return safeFailure(res, status, code, status === 503 ? 'Push delivery is temporarily unavailable.' : 'Your sign-in could not be verified. Sign in again and retry.', 'token_validation')
  }

  const { firestore, messaging, FieldValue, projectId } = services
  let deliveryRef = null
  let sendStarted = false
  try {
    if (projectId !== globalThis.process?.env?.FIREBASE_PROJECT_ID) {
      return safeFailure(res, 503, 'PUSH_PROJECT_CONFIG_MISMATCH', 'Push delivery is temporarily unavailable.', 'project_validation')
    }
    const tripSnapshot = await firestore.collection('trips').doc(tripId).get()
    if (!tripSnapshot.exists) return safeFailure(res, 404, 'TRIP_NOT_FOUND', 'This trip is no longer available.', 'trip_lookup')
    const trip = tripSnapshot.data()
    const memberIds = getCurrentMemberIds(trip)
    if (!memberIds.includes(identity.uid)) {
      return safeFailure(res, 403, 'TRIP_MEMBERSHIP_REQUIRED', 'You are no longer a member of this trip.', 'membership_check')
    }

    const persistedEvent = await validatePersistedEvent({ firestore, tripId, eventId, eventType, uid: identity.uid, trip })
    if (!persistedEvent) return safeFailure(res, 403, 'EVENT_NOT_AUTHORIZED', 'This trip update could not be verified.', 'event_verification')

    const eventKey = createHash('sha256').update(`${projectId}:${tripId}:${eventType}:${persistedEvent.dedupeId || eventId}`).digest('hex')
    deliveryRef = firestore.collection('pushDeliveryEvents').doc(eventKey)
    const claimed = await firestore.runTransaction(async (transaction) => {
      const previous = await transaction.get(deliveryRef)
      if (previous.exists) return false
      transaction.create(deliveryRef, {
        tripId,
        eventId,
        eventType,
        actorUid: identity.uid,
        status: 'sending',
        createdAt: FieldValue.serverTimestamp(),
      })
      return true
    })
    if (!claimed) return sendJson(res, 200, { sent: 0, duplicate: true })

    const recipientIds = persistedEvent.targetUid
      ? [persistedEvent.targetUid]
      : memberIds.filter((uid) => uid !== identity.uid)
    const tokenDocs = []
    for (const recipientUid of recipientIds) {
      try {
        const recipient = await services.auth.getUser(recipientUid)
        if (recipient.disabled || !recipient.providerData?.length) continue
        const snapshot = await firestore.collection('users').doc(recipientUid).collection('deviceTokens').get()
        snapshot.docs.forEach((tokenDoc) => {
          const data = tokenDoc.data()
          if (typeof data.token === 'string' && data.token.length >= 20 && data.platform === 'android') {
            tokenDocs.push({ ref: tokenDoc.ref, token: data.token })
          }
        })
      } catch (error) {
        if (error?.code === 'auth/user-not-found') continue
        throw error
      }
    }

    let successCount = 0
    let failureCount = 0
    const message = {
      notification: {
        title: 'Contri',
        body: eventType === 'trip_member_added'
          ? 'You were added to a Contri trip. Open Contri to view it.'
          : 'There is a new update in one of your trips. Open Contri to view it.',
      },
      data: { eventType, tripId, recordId: persistedEvent.recordId, destination: persistedEvent.destination },
      android: {
        priority: 'high',
        notification: {
          channelId: 'contri_updates',
          icon: 'ic_stat_contri',
          color: '#0F8F83',
        },
      },
    }
    for (let offset = 0; offset < tokenDocs.length; offset += 500) {
      const chunk = tokenDocs.slice(offset, offset + 500)
      sendStarted = true
      const result = await messaging.sendEachForMulticast({ ...message, tokens: chunk.map((item) => item.token) })
      successCount += result.successCount
      failureCount += result.failureCount
      await Promise.all(result.responses.map(async (response, index) => {
        if (response.success) return
        const code = response.error?.code || ''
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          await chunk[index].ref.delete()
          return
        }
        if (['messaging/server-unavailable', 'messaging/internal-error', 'messaging/unknown-error', 'messaging/message-rate-exceeded', 'messaging/device-message-rate-exceeded'].includes(code)) {
          try {
            await messaging.send({ ...message, token: chunk[index].token })
            successCount += 1
            failureCount -= 1
          } catch {
            // Keep the failed delivery count. Successful tokens are never resent.
          }
        }
      }))
    }

    await deliveryRef.update({
      status: 'completed',
      successCount,
      failureCount,
      tokenCount: tokenDocs.length,
      completedAt: FieldValue.serverTimestamp(),
    })
    return sendJson(res, 200, { sent: successCount, failed: failureCount, duplicate: false })
  } catch (error) {
    if (!sendStarted && deliveryRef) {
      try { await deliveryRef.delete() } catch { /* A retained claim is safer than duplicate delivery. */ }
    }
    return safeFailure(res, 503, 'PUSH_DELIVERY_FAILED', 'The trip update was saved, but push delivery is temporarily unavailable.', 'delivery', {
      firebaseCode: typeof error?.code === 'string' ? error.code : 'unknown',
    })
  }
}
