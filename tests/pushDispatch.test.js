import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPushDispatchHandler } from '../api/_lib/pushDispatch.js'
import { buildPushNotificationContent, getPushChannelForPreference, PUSH_CHANNELS } from '../api/_lib/pushContent.js'

globalThis.process.env.FIREBASE_PROJECT_ID = 'contri-app-33f5a'

const makeResponse = () => ({
  headers: {},
  setHeader(key, value) { this.headers[key] = value },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  end() { return this },
})

const createServices = ({ trip, expense, activity, tokens = [], priorDelivery = false, invalidToken = false, identity } = {}) => {
  const sent = []
  const deletedTokens = []
  let delivered = priorDelivery
  const tokenDocs = tokens.map((item) => ({
    ref: { delete: async () => deletedTokens.push(item.token) },
    data: () => item,
  }))
  const ref = (path) => ({
    path,
    async get() {
      const parts = path.split('/')
      if (parts[0] === 'trips' && parts.length === 2) return { exists: Boolean(trip), data: () => trip }
      if (path === 'trips/trip-a/activity/activity-a') return { exists: Boolean(activity), data: () => activity }
      if (path === 'trips/trip-a/expenses/expense-a') return { exists: Boolean(expense), data: () => expense }
      if (path === 'users/member-a/deviceTokens') return { docs: tokenDocs }
      if (parts[0] === 'pushDeliveryEvents') return { exists: delivered }
      return { exists: false }
    },
    collection(name) { return collectionRef(`${path}/${name}`) },
    async update(value) { this.updated = value },
  })
  const collectionRef = (path) => ({
    doc(id) { return ref(`${path}/${id || 'auto-id'}`) },
    async get() { return { docs: path === 'users/member-a/deviceTokens' ? tokenDocs : [] } },
  })
  const services = {
    projectId: 'contri-app-33f5a',
    auth: {
      verifyIdToken: async () => identity || ({ uid: 'actor-a', aud: 'contri-app-33f5a', iss: 'https://securetoken.google.com/contri-app-33f5a', firebase: { sign_in_provider: 'google.com' } }),
      getUser: async (uid) => ({ disabled: false, providerData: [{ providerId: 'google.com' }], uid }),
    },
    firestore: {
      collection: collectionRef,
      async runTransaction(work) {
        const transaction = {
          async get(deliveryRef) { return { exists: delivered, ref: deliveryRef } },
          create() { delivered = true },
        }
        return work(transaction)
      },
    },
    messaging: { sendEachForMulticast: async ({ tokens: sendTokens, ...payload }) => {
      sent.push({ tokens: sendTokens, payload })
      return invalidToken
        ? { successCount: 0, failureCount: sendTokens.length, responses: sendTokens.map(() => ({ success: false, error: { code: 'messaging/registration-token-not-registered' } })) }
        : { successCount: sendTokens.length, failureCount: 0, responses: sendTokens.map(() => ({ success: true })) }
    } },
    FieldValue: { serverTimestamp: () => 'timestamp' },
  }
  return { services, sent, deletedTokens }
}

const makeRequest = (overrides = {}) => ({
  method: 'POST',
  headers: { authorization: 'Bearer verified-test-token' },
  body: { tripId: 'trip-a', eventId: 'activity-a', eventType: 'expense_created' },
  ...overrides,
})

test('persisted expense push excludes actor and derives only current trip recipients', async () => {
  const eventTimestamp = new Date()
  const { services, sent } = createServices({
    trip: { name: 'Goa Trip', currency: 'INR', members: [{ uid: 'actor-a', name: 'Tejas' }], memberIds: ['actor-a', 'member-a'], createdBy: 'actor-a' },
    expense: { title: 'Dinner', amount: 500, currency: 'INR', createdBy: 'actor-a', paidBy: 'actor-a', splitAmong: [{ uid: 'actor-a' }], createdAt: eventTimestamp },
    activity: { type: 'expense_created', actorUid: 'actor-a', actorName: 'Tejas', timestamp: eventTimestamp, meta: { expenseId: 'expense-a' } },
    tokens: [{ token: 'member-token-abcdefghijklmnopqrstuvwxyz', platform: 'android', soundEnabled: true }],
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 200)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].tokens, ['member-token-abcdefghijklmnopqrstuvwxyz'])
  assert.equal(sent[0].payload.notification.title, 'New expense added')
  assert.equal(sent[0].payload.notification.body, 'Tejas added ₹500 for Dinner in Goa Trip.')
  assert.equal(sent[0].payload.android.notification.channelId, PUSH_CHANNELS.audible)
  assert.equal(sent[0].payload.android.notification.icon, 'ic_stat_contri')
  assert.equal('sound' in sent[0].payload.android.notification, false, 'OS channel default handles sound')
})

test('persisted event metadata creates concise event-specific notification content', () => {
  const trip = { name: 'Goa Trip', currency: 'INR', members: [{ uid: 'actor', name: 'Tejas' }] }
  const actorActivity = { actorUid: 'actor', actorName: 'Tejas' }
  assert.deepEqual(buildPushNotificationContent({ eventType: 'expense_created', trip, record: { title: 'Dinner', amount: 500 }, activity: actorActivity }), {
    title: 'New expense added', body: 'Tejas added ₹500 for Dinner in Goa Trip.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'expense_updated', trip, record: { title: 'Petrol' }, activity: { ...actorActivity, actorName: 'Jyoti' } }), {
    title: 'Expense updated', body: 'Jyoti updated the Petrol expense in Goa Trip.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'settlement_created', trip, record: { amount: 1000 }, activity: actorActivity }), {
    title: 'Settlement recorded', body: 'Tejas recorded a ₹1,000 payment in Goa Trip.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'advance_recorded', trip, record: { amountPaise: 200000, recordedBy: 'actor' } }), {
    title: 'Advance contribution added', body: 'Tejas recorded an advance contribution of ₹2,000 in Goa Trip.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'trip_member_added', trip }), {
    title: 'Trip invitation', body: 'You have been invited to join Goa Trip.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'trip_member_joined', trip, activity: actorActivity }), {
    title: 'New member joined', body: 'Tejas joined Goa Trip.',
  })
})

test('push content uses safe fallbacks for unknown event types and incomplete metadata', () => {
  assert.deepEqual(buildPushNotificationContent({ eventType: 'future_event', trip: { name: '<Mountain>' } }), {
    title: 'Trip update', body: 'A trip member recorded a future event update in <Mountain>.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'expense_created', trip: {}, record: {} }), {
    title: 'New expense added', body: 'A trip member added an expense.',
  })
  assert.deepEqual(buildPushNotificationContent({ eventType: 'settlement_created', trip: {}, record: { amount: 'unknown' } }), {
    title: 'Settlement recorded', body: 'A trip member recorded a payment.',
  })
  assert.equal(buildPushNotificationContent({
    eventType: 'expense_created',
    trip: { name: 'Goa & Konkan', currency: 'INR' },
    record: { title: 'Dinner: “Thali”', amount: 125.5 },
    activity: { actorName: 'Jyoti & Rahul' },
  }).body, 'Jyoti & Rahul added ₹125.5 for Dinner: “Thali” in Goa & Konkan.')
})

test('sound preference maps to stable versioned audible and silent channels', () => {
  assert.equal(getPushChannelForPreference(true), 'contri_updates_v2')
  assert.equal(getPushChannelForPreference(false), 'contri_updates_silent_v2')
  assert.equal(getPushChannelForPreference(undefined), 'contri_updates_silent_v2')
})

test('same verified event selects sound or silent channel per recipient device preference', async () => {
  const eventTimestamp = new Date()
  const { services, sent } = createServices({
    trip: { name: 'Goa Trip', currency: 'INR', memberIds: ['actor-a', 'member-a'], createdBy: 'actor-a' },
    expense: { title: 'Dinner', amount: 500, createdBy: 'actor-a', paidBy: 'actor-a', splitAmong: [{ uid: 'actor-a' }], createdAt: eventTimestamp },
    activity: { type: 'expense_created', actorUid: 'actor-a', actorName: 'Tejas', timestamp: eventTimestamp, meta: { expenseId: 'expense-a' } },
    tokens: [
      { token: 'audible-device-token-abcdefghijklmnopqrstuvwxyz', platform: 'android', soundEnabled: true },
      { token: 'silent-device-token-abcdefghijklmnopqrstuvwxyz', platform: 'android', soundEnabled: false },
    ],
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 200)
  assert.equal(sent.length, 2)
  assert.equal(sent.find((item) => item.tokens[0].startsWith('audible')).payload.android.notification.channelId, PUSH_CHANNELS.audible)
  assert.equal(sent.find((item) => item.tokens[0].startsWith('silent')).payload.android.notification.channelId, PUSH_CHANNELS.silent)
})

test('persisted member-joined event sends a concise update only to the other current members', async () => {
  const timestamp = new Date()
  const { services, sent } = createServices({
    trip: { name: 'Goa Trip', memberIds: ['actor-a', 'member-a'], createdBy: 'actor-a', members: [{ uid: 'actor-a', name: 'Rahul' }] },
    activity: { type: 'trip_member_joined', actorUid: 'actor-a', actorName: 'Rahul', timestamp },
    tokens: [{ token: 'other-member-token-abcdefghijklmnopqrstuvwxyz', platform: 'android', soundEnabled: true }],
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest({
    body: { tripId: 'trip-a', eventId: 'activity-a', eventType: 'trip_member_joined' },
  }), response)
  assert.equal(response.statusCode, 200)
  assert.equal(sent[0].payload.notification.title, 'New member joined')
  assert.equal(sent[0].payload.notification.body, 'Rahul joined Goa Trip.')
  assert.deepEqual(sent[0].tokens, ['other-member-token-abcdefghijklmnopqrstuvwxyz'])
})

test('push endpoint rejects non-members and arbitrary unpersisted events', async () => {
  const { services, sent } = createServices({
    trip: { memberIds: ['member-a'], createdBy: 'member-a' },
    expense: { createdBy: 'actor-a', paidBy: 'member-a', splitAmong: [{ uid: 'member-a' }] },
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 403)
  assert.equal(sent.length, 0)
})

test('duplicate push event is idempotently suppressed', async () => {
  const eventTimestamp = new Date()
  const { services, sent } = createServices({
    trip: { memberIds: ['actor-a', 'member-a'], createdBy: 'actor-a' },
    expense: { createdBy: 'actor-a', paidBy: 'actor-a', splitAmong: [{ uid: 'actor-a' }], createdAt: eventTimestamp },
    activity: { type: 'expense_created', actorUid: 'actor-a', timestamp: eventTimestamp, meta: { expenseId: 'expense-a' } },
    priorDelivery: true,
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.duplicate, true)
  assert.equal(sent.length, 0)
})

test('guest accounts cannot request push delivery', async () => {
  const { services, sent } = createServices({
    identity: { uid: 'actor-a', aud: 'contri-app-33f5a', iss: 'https://securetoken.google.com/contri-app-33f5a', firebase: { sign_in_provider: 'anonymous' } },
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 403)
  assert.equal(response.body.error, 'GUEST_PUSH_DISABLED')
  assert.equal(sent.length, 0)
})

test('invalid FCM registration tokens are removed from their own token records', async () => {
  const eventTimestamp = new Date()
  const token = 'member-token-abcdefghijklmnopqrstuvwxyz'
  const { services, deletedTokens } = createServices({
    trip: { memberIds: ['actor-a', 'member-a'], createdBy: 'actor-a' },
    expense: { createdBy: 'actor-a', paidBy: 'actor-a', splitAmong: [{ uid: 'actor-a' }], createdAt: eventTimestamp },
    activity: { type: 'expense_created', actorUid: 'actor-a', timestamp: eventTimestamp, meta: { expenseId: 'expense-a' } },
    tokens: [{ token, platform: 'android' }],
    invalidToken: true,
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(deletedTokens, [token])
})

test('a fresh forged activity cannot trigger push for an older persisted expense', async () => {
  const { services, sent } = createServices({
    trip: { memberIds: ['actor-a', 'member-a'], createdBy: 'actor-a' },
    expense: { createdBy: 'actor-a', paidBy: 'actor-a', splitAmong: [{ uid: 'actor-a' }], createdAt: new Date(Date.now() - 60 * 60_000) },
    activity: { type: 'expense_created', actorUid: 'actor-a', timestamp: new Date(), meta: { expenseId: 'expense-a' } },
  })
  const response = makeResponse()
  await createPushDispatchHandler({ getServices: () => services })(makeRequest(), response)
  assert.equal(response.statusCode, 403)
  assert.equal(response.body.error, 'EVENT_NOT_AUTHORIZED')
  assert.equal(sent.length, 0)
})
