import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createNotificationArrivalDetector,
  isNotificationSoundEnabled,
  NOTIFICATION_SOUND_STORAGE_KEY,
  persistNotificationSoundPreference,
} from '../src/lib/notificationSound.js'

const createSnapshot = ({ docs = [], changes = [], fromCache = false } = {}) => ({
  docs: docs.map(({ id, data }) => ({ id, data: () => data })),
  metadata: { fromCache },
  docChanges: () => changes.map(({ type, id, data }) => ({ type, doc: { id, data: () => data } })),
})

test('sound preference remains off by default and persists across app sessions', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(isNotificationSoundEnabled(storage), false)
  assert.equal(persistNotificationSoundPreference(true, storage), true)
  assert.equal(values.get(NOTIFICATION_SOUND_STORAGE_KEY), 'on')
  assert.equal(isNotificationSoundEnabled(storage), true)
  persistNotificationSoundPreference(false, storage)
  assert.equal(isNotificationSoundEnabled(storage), false)
})

test('initial history, cache snapshots, duplicate changes and self-created notifications remain silent', () => {
  const added = []
  const seenKeys = new Set()
  const detect = createNotificationArrivalDetector('member-1', { seenKeys, onArrival: (doc) => added.push(doc.id) })
  detect(createSnapshot({ docs: [{ id: 'history', data: {} }], fromCache: true }))
  detect(createSnapshot({ docs: [{ id: 'history', data: {} }] }))
  detect(createSnapshot({ changes: [{ type: 'added', id: 'history', data: { actorUid: 'member-2' } }] }))
  detect(createSnapshot({ changes: [{ type: 'added', id: 'live', data: { actorUid: 'member-2' } }] }))
  detect(createSnapshot({ changes: [{ type: 'added', id: 'live', data: { actorUid: 'member-2' } }] }))
  detect(createSnapshot({ changes: [{ type: 'added', id: 'own', data: { actorUid: 'member-1' } }] }))
  assert.deepEqual(added, ['live'])
  assert.equal(seenKeys.has('member-1:live'), true)
})

test('sound preference safely falls back to muted when browser storage is unavailable', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(isNotificationSoundEnabled(blocked), false)
  assert.equal(persistNotificationSoundPreference(true, blocked), true)
  assert.equal(isNotificationSoundEnabled(blocked), false)
})
