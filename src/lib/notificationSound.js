export const NOTIFICATION_SOUND_STORAGE_KEY = 'contri-notification-sound'
export const NOTIFICATION_SOUND_DURATION_SECONDS = 1.24

const SOUND_URL = new URL('../assets/notification-coin.wav', import.meta.url).href
const MAX_SCHEDULED_SOUNDS = 2
const getStorage = (storage) => storage ?? globalThis.localStorage

export const isNotificationSoundEnabled = (storage) => {
  try {
    return getStorage(storage)?.getItem(NOTIFICATION_SOUND_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export const persistNotificationSoundPreference = (enabled, storage) => {
  const normalized = Boolean(enabled)
  try {
    getStorage(storage)?.setItem(NOTIFICATION_SOUND_STORAGE_KEY, normalized ? 'on' : 'off')
  } catch {
    // Audio can still be controlled for the current session if storage is blocked.
  }
  return normalized
}

const loadBundledBuffer = async (audioContext) => {
  const response = await fetch(SOUND_URL)
  if (!response.ok) throw new Error('The bundled notification sound could not be loaded.')
  return audioContext.decodeAudioData(await response.arrayBuffer())
}

export const createNotificationSoundPlayer = ({
  AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext,
  storage,
  loadBuffer = loadBundledBuffer,
  durationSeconds = NOTIFICATION_SOUND_DURATION_SECONDS,
} = {}) => {
  let audioContext = null
  let audioBuffer = null
  let bufferPromise = null
  let nextStartTime = 0
  let scheduledSounds = 0

  const getBuffer = async () => {
    if (audioBuffer) return audioBuffer
    if (!bufferPromise) {
      bufferPromise = Promise.resolve(loadBuffer(audioContext))
        .then((buffer) => {
          if (!buffer) throw new Error('The bundled notification sound is empty.')
          audioBuffer = buffer
          return buffer
        })
        .catch((error) => {
          bufferPromise = null
          throw error
        })
    }
    return bufferPromise
  }

  const enable = async () => {
    if (!AudioContextConstructor) return false
    try {
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContextConstructor()
        audioBuffer = null
        bufferPromise = null
        nextStartTime = 0
        scheduledSounds = 0
      }
      if (audioContext.state === 'suspended') await audioContext.resume()
      if (audioContext.state !== 'running') return false
      await getBuffer()
      return true
    } catch {
      return false
    }
  }

  const disable = async () => {
    if (!audioContext || audioContext.state === 'closed') return
    try {
      await audioContext.close()
    } catch {
      // The preference is still off if an audio context cannot be closed.
    }
    audioContext = null
    audioBuffer = null
    bufferPromise = null
    nextStartTime = 0
    scheduledSounds = 0
  }

  const setEnabled = async (enabled) => {
    const normalized = persistNotificationSoundPreference(enabled, storage)
    if (!normalized) {
      await disable()
      return true
    }
    return enable()
  }

  const emitSound = async () => {
    if (!audioContext || audioContext.state !== 'running') return false
    if (scheduledSounds >= MAX_SCHEDULED_SOUNDS) return false

    try {
      const buffer = await getBuffer()
      if (!audioContext || audioContext.state !== 'running') return false
      // Multiple Firestore additions can call play before the bundled buffer resolves.
      // Re-check after that await so a burst cannot overfill the short playback queue.
      if (scheduledSounds >= MAX_SCHEDULED_SOUNDS) return false
      const now = audioContext.currentTime
      const startAt = Math.max(now, nextStartTime)
      const source = audioContext.createBufferSource()
      const gain = audioContext.createGain()
      source.buffer = buffer
      // Keep digital headroom; device media volume remains in control of perceived loudness.
      gain.gain.setValueAtTime(0.82, startAt)
      source.connect(gain)
      gain.connect(audioContext.destination)
      scheduledSounds += 1
      nextStartTime = startAt + durationSeconds
      source.onended = () => {
        scheduledSounds = Math.max(0, scheduledSounds - 1)
        if (scheduledSounds === 0 && audioContext) nextStartTime = audioContext.currentTime
      }
      source.start(startAt)
      return true
    } catch {
      return false
    }
  }

  const play = async () => {
    if (!isNotificationSoundEnabled(storage) || !audioContext) return false
    try {
      if (audioContext.state === 'suspended') await audioContext.resume()
      return await emitSound()
    } catch {
      return false
    }
  }

  const preview = async () => {
    if (!(await enable())) return false
    return emitSound()
  }

  return { enable, disable, play, preview, setEnabled }
}

const notificationSoundPlayer = createNotificationSoundPlayer()

export const setNotificationSoundEnabled = (enabled) => notificationSoundPlayer.setEnabled(enabled)
export const playNotificationSound = () => notificationSoundPlayer.play()
export const previewNotificationSound = () => notificationSoundPlayer.preview()
export const prepareNotificationSound = () => {
  if (!isNotificationSoundEnabled()) return Promise.resolve(false)
  return notificationSoundPlayer.enable()
}

const recentNotificationKeys = new Set()
const MAX_RECENT_NOTIFICATION_KEYS = 1000

export const createNotificationArrivalDetector = (
  uid,
  { play = playNotificationSound, seenKeys = recentNotificationKeys } = {},
) => {
  let hasServerBaseline = false
  const makeKey = (notificationId) => `${uid}:${notificationId}`
  const remember = (key) => {
    seenKeys.add(key)
    if (seenKeys.size > MAX_RECENT_NOTIFICATION_KEYS) {
      const oldest = seenKeys.values().next().value
      seenKeys.delete(oldest)
    }
  }

  return (snapshot) => {
    if (snapshot.metadata?.fromCache) return

    if (!hasServerBaseline) {
      snapshot.docs.forEach((item) => remember(makeKey(item.id)))
      hasServerBaseline = true
      return
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return
      const key = makeKey(change.doc.id)
      if (seenKeys.has(key)) return
      remember(key)
      if (change.doc.data().actorUid !== uid) void play()
    })
  }
}
