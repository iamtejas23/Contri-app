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
    // Push delivery can still use the device's saved channel preference.
  }
  return normalized
}

const recentNotificationKeys = new Set()
const MAX_RECENT_NOTIFICATION_KEYS = 1000

/**
 * Establishes a server baseline and deduplicates Firestore arrivals. Android
 * sound is emitted by the FCM notification channel; this detector deliberately
 * does not play a second bundled sound.
 */
export const createNotificationArrivalDetector = (uid, { seenKeys = recentNotificationKeys, onArrival = () => {} } = {}) => {
  let hasServerBaseline = false
  const makeKey = (notificationId) => `${uid}:${notificationId}`
  const remember = (key) => {
    seenKeys.add(key)
    if (seenKeys.size > MAX_RECENT_NOTIFICATION_KEYS) seenKeys.delete(seenKeys.values().next().value)
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
      if (change.doc.data()?.actorUid !== uid) onArrival(change.doc)
    })
  }
}
