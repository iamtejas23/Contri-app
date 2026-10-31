import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createNotificationArrivalDetector,
  createNotificationSoundPlayer,
  isNotificationSoundEnabled,
  NOTIFICATION_SOUND_DURATION_SECONDS,
  NOTIFICATION_SOUND_STORAGE_KEY,
  persistNotificationSoundPreference,
} from '../src/lib/notificationSound.js'

const loadTestBuffer = async () => ({ duration: NOTIFICATION_SOUND_DURATION_SECONDS })

const createSnapshot = ({ docs = [], changes = [], fromCache = false } = {}) => ({
  docs: docs.map(({ id, data }) => ({ id, data: () => data })),
  metadata: { fromCache },
  docChanges: () => changes.map(({ type, id, data }) => ({
    type,
    doc: { id, data: () => data },
  })),
})

test('initial notification history and cache snapshots never play a sound', () => {
  const played = []
  const detect = createNotificationArrivalDetector('member-1', {
    play: () => played.push('sound'),
    seenKeys: new Set(),
  })

  detect(createSnapshot({ docs: [{ id: 'old', data: { actorUid: 'member-2' } }], fromCache: true }))
  detect(createSnapshot({ docs: [{ id: 'old', data: { actorUid: 'member-2' } }] }))
  detect(createSnapshot({ changes: [{ type: 'added', id: 'old', data: { actorUid: 'member-2' } }] }))
  assert.deepEqual(played, [])
})

test('cache-to-server metadata transition establishes the baseline before a live notification', () => {
  const played = []
  const detect = createNotificationArrivalDetector('member-1', {
    play: () => played.push('sound'),
    seenKeys: new Set(),
  })

  detect(createSnapshot({ docs: [{ id: 'history', data: { actorUid: 'member-2' } }], fromCache: true }))
  // Firestore can deliver this server acknowledgement without document changes.
  detect(createSnapshot({ docs: [{ id: 'history', data: { actorUid: 'member-2' } }] }))
  detect(createSnapshot({ changes: [{ type: 'added', id: 'live', data: { actorUid: 'member-2' } }] }))

  assert.deepEqual(played, ['sound'])
})

test('new notifications play once, excluding self-created and modified records', () => {
  const played = []
  const seenKeys = new Set()
  const detect = createNotificationArrivalDetector('member-1', {
    play: () => played.push('sound'),
    seenKeys,
  })
  detect(createSnapshot())

  const newMemberNotification = { id: 'new-expense', type: 'added', data: { actorUid: 'member-2' } }
  detect(createSnapshot({ changes: [
    newMemberNotification,
    { id: 'own-expense', type: 'added', data: { actorUid: 'member-1' } },
    { id: 'read-update', type: 'modified', data: { actorUid: 'member-2' } },
  ] }))
  detect(createSnapshot({ changes: [newMemberNotification] }))

  assert.deepEqual(played, ['sound'])
  assert.equal(seenKeys.has('member-1:own-expense'), true)
})

test('notification sound is muted by default and the local preference restores across sessions', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  assert.equal(isNotificationSoundEnabled(storage), false)
  assert.equal(persistNotificationSoundPreference(true, storage), true)
  assert.equal(values.get(NOTIFICATION_SOUND_STORAGE_KEY), 'on')
  assert.equal(isNotificationSoundEnabled(storage), true)
})

test('audio starts only when enabled by user interaction and playback failures are contained', async () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  let contextsCreated = 0
  const scheduledAt = []
  let resumeCalls = 0
  let latestContext
  class AudioContextMock {
    constructor() {
      contextsCreated += 1
      this.state = 'suspended'
      this.currentTime = 0
      this.destination = {}
      latestContext = this
    }
    async resume() { resumeCalls += 1; this.state = 'running' }
    async close() { this.state = 'closed' }
    createBufferSource() { return { connect() {}, start(time) { scheduledAt.push(time) } } }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      }
    }
  }

  const player = createNotificationSoundPlayer({ AudioContextConstructor: AudioContextMock, storage, loadBuffer: loadTestBuffer })
  assert.equal(await player.play(), false)
  assert.equal(contextsCreated, 0)
  assert.equal(await player.setEnabled(true), true)
  assert.equal(contextsCreated, 1)
  assert.equal(await player.play(), true)
  assert.equal(scheduledAt.length, 1)
  latestContext.state = 'suspended'
  assert.equal(await player.play(), true)
  assert.equal(resumeCalls, 2)
  assert.equal(scheduledAt.length, 2)
  assert.equal(scheduledAt[1] - scheduledAt[0], NOTIFICATION_SOUND_DURATION_SECONDS, 'queued sounds do not overlap')
  assert.equal(await player.setEnabled(false), true)
  assert.equal(isNotificationSoundEnabled(storage), false)
  assert.equal(await player.preview(), true)
  assert.equal(isNotificationSoundEnabled(storage), false)
  assert.equal(scheduledAt.length, 3)
  await player.setEnabled(false)
  assert.equal(isNotificationSoundEnabled(storage), false)
  assert.equal(await player.play(), false)

  const blockedPlayer = createNotificationSoundPlayer({
    AudioContextConstructor: class { constructor() { throw new Error('autoplay blocked') } },
    storage,
    loadBuffer: loadTestBuffer,
  })
  assert.equal(await blockedPlayer.setEnabled(true), false)
  assert.equal(await blockedPlayer.play(), false)
  assert.equal(await blockedPlayer.preview(), false)
})

test('notification bursts queue cleanly without overlap or an unbounded sound backlog', async () => {
  const storage = { getItem: () => 'on', setItem() {} }
  const startTimes = []
  class AudioContextMock {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {} }
    async resume() { this.state = 'running' }
    async close() { this.state = 'closed' }
    createBufferSource() { return { connect() {}, start: (time) => startTimes.push(time) } }
    createGain() { return { gain: { setValueAtTime() {} }, connect() {} } }
  }
  const player = createNotificationSoundPlayer({
    AudioContextConstructor: AudioContextMock,
    storage,
    loadBuffer: loadTestBuffer,
  })
  await player.enable()
  const results = await Promise.all([player.play(), player.play(), player.play()])
  assert.equal(startTimes.length, 2)
  assert.equal(results.filter(Boolean).length, 2)
  assert.equal(startTimes[1] - startTimes[0], NOTIFICATION_SOUND_DURATION_SECONDS)
})

test('restored sound preference prepares after a gesture and live notifications play once', async () => {
  const values = new Map([[NOTIFICATION_SOUND_STORAGE_KEY, 'on']])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  let sourceStarts = 0
  class AudioContextMock {
    constructor() {
      this.state = 'suspended'
      this.currentTime = 0
      this.destination = {}
    }
    async resume() { this.state = 'running' }
    async close() { this.state = 'closed' }
    createBufferSource() { return { connect() {}, start() { sourceStarts += 1 } } }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
    }
  }

  const player = createNotificationSoundPlayer({ AudioContextConstructor: AudioContextMock, storage, loadBuffer: loadTestBuffer })
  assert.equal(await player.play(), false, 'restored preference alone must not bypass browser gesture rules')
  assert.equal(await player.enable(), true, 'the app prepares audio in response to a user gesture')

  const seenKeys = new Set()
  const detect = createNotificationArrivalDetector('member-1', {
    play: () => player.play(),
    seenKeys,
  })
  detect(createSnapshot({ docs: [{ id: 'history', data: { actorUid: 'member-2' } }] }))
  const incoming = { type: 'added', id: 'new-expense', data: { actorUid: 'member-2' } }
  detect(createSnapshot({ changes: [incoming] }))
  detect(createSnapshot({ changes: [incoming] }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(sourceStarts, 1)

  await player.setEnabled(false)
  detect(createSnapshot({ changes: [{ ...incoming, id: 'muted-expense' }] }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(sourceStarts, 1, 'muted preferences suppress the live sound')

  const reconnectDetector = createNotificationArrivalDetector('member-1', {
    play: () => player.play(),
    seenKeys,
  })
  reconnectDetector(createSnapshot({ docs: [
    { id: 'history', data: { actorUid: 'member-2' } },
    { id: 'new-expense', data: { actorUid: 'member-2' } },
  ] }))
  reconnectDetector(createSnapshot({ changes: [incoming] }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(sourceStarts, 1, 'reconnect and duplicate snapshots do not replay sounds')
})

test('sound preference and playback remain safe when browser storage or audio APIs fail', async () => {
  const blockedStorage = {
    getItem: () => { throw new Error('storage blocked') },
    setItem: () => { throw new Error('storage blocked') },
  }
  const player = createNotificationSoundPlayer({
    AudioContextConstructor: undefined,
    storage: blockedStorage,
    loadBuffer: loadTestBuffer,
  })
  assert.equal(isNotificationSoundEnabled(blockedStorage), false)
  assert.equal(persistNotificationSoundPreference(true, blockedStorage), true)
  assert.equal(await player.setEnabled(true), false)
  assert.equal(await player.play(), false)

  class BrokenPlaybackContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
    }
    createBufferSource() { throw new Error('audio output unavailable') }
    async close() { this.state = 'closed' }
  }
  const playbackValues = new Map()
  const playbackStorage = {
    getItem: (key) => playbackValues.get(key) ?? null,
    setItem: (key, value) => playbackValues.set(key, value),
  }
  const playbackPlayer = createNotificationSoundPlayer({
    AudioContextConstructor: BrokenPlaybackContext,
    storage: playbackStorage,
    loadBuffer: loadTestBuffer,
  })
  assert.equal(await playbackPlayer.setEnabled(true), true)
  assert.equal(await playbackPlayer.play(), false)
  await playbackPlayer.setEnabled(false)
})
