export const NOTIFICATION_SOUND_STORAGE_KEY = 'contri-notification-sound'

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

export const createNotificationSoundPlayer = ({
  AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext,
  storage,
} = {}) => {
  let audioContext = null

  const enable = async () => {
    if (!AudioContextConstructor) return false
    try {
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContextConstructor()
      }
      if (audioContext.state === 'suspended') await audioContext.resume()
      return audioContext.state === 'running'
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
  }

  const setEnabled = async (enabled) => {
    const normalized = persistNotificationSoundPreference(enabled, storage)
    if (!normalized) {
      await disable()
      return true
    }
    return enable()
  }

  const emitTone = () => {
    if (!audioContext || audioContext.state !== 'running') {
      return false
    }

    try {
      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(660, now)
      oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.21)
      return true
    } catch {
      return false
    }
  }

  const play = async () => {
    if (!isNotificationSoundEnabled(storage) || !audioContext) return false
    try {
      // WebViews can suspend an already-unlocked context when the app loses focus.
      if (audioContext.state === 'suspended') await audioContext.resume()
      return emitTone()
    } catch {
      return false
    }
  }

  const preview = async () => {
    if (!(await enable())) return false
    return emitTone()
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
