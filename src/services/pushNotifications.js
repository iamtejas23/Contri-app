import { Capacitor } from '@capacitor/core'
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { PushNotifications } from '@capacitor/push-notifications'

import { auth, db } from '../firebase/config'
import { isNotificationSoundEnabled } from '../lib/notificationSound.js'

export const PUSH_CHANNELS = Object.freeze({ audible: 'contri_updates_v2', silent: 'contri_updates_silent_v2' })

const preferenceKey = (uid) => `contri-push-enabled:${uid}`
const tokenKey = (uid) => `contri-push-token:${uid}`

export const isAndroidPushSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
export const isPushEnabled = (uid) => Boolean(uid && globalThis.localStorage?.getItem(preferenceKey(uid)) === 'true')

const tokenDocumentId = async (token) => {
  const bytes = new TextEncoder().encode(token)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export const saveOwnPushToken = async (uid, token) => {
  if (!uid || auth.currentUser?.uid !== uid || auth.currentUser.isAnonymous || !token) return false
  const id = await tokenDocumentId(token)
  let previous
  try { previous = JSON.parse(globalThis.localStorage?.getItem(tokenKey(uid)) || 'null') } catch { previous = null }
  const tokenRef = doc(db, 'users', uid, 'deviceTokens', id)
  const tokenData = {
    token,
    platform: 'android',
    soundEnabled: isNotificationSoundEnabled(),
    updatedAt: serverTimestamp(),
  }
  try {
    await setDoc(tokenRef, tokenData)
  } catch (error) {
    // Keep push registration compatible with installations using the previously
    // deployed token rule until the optional sound field is approved/deployed.
    if (error?.code !== 'permission-denied') throw error
    const legacyTokenData = { ...tokenData }
    delete legacyTokenData.soundEnabled
    await setDoc(tokenRef, legacyTokenData)
  }
  if (previous?.id && previous.id !== id) {
    await deleteDoc(doc(db, 'users', uid, 'deviceTokens', previous.id))
  }
  globalThis.localStorage?.setItem(tokenKey(uid), JSON.stringify({ id, token }))
  return true
}

export const syncOwnPushSoundPreference = async (uid, enabled) => {
  if (!uid || auth.currentUser?.uid !== uid || auth.currentUser.isAnonymous) return false
  let saved
  try { saved = JSON.parse(globalThis.localStorage?.getItem(tokenKey(uid)) || 'null') } catch { saved = null }
  if (!saved?.id) return false
  await updateDoc(doc(db, 'users', uid, 'deviceTokens', saved.id), {
    soundEnabled: Boolean(enabled),
    updatedAt: serverTimestamp(),
  })
  return true
}

export const removeOwnPushToken = async (uid, { forgetPreference = false } = {}) => {
  if (!uid || auth.currentUser?.uid !== uid) return false
  let saved
  try { saved = JSON.parse(globalThis.localStorage?.getItem(tokenKey(uid)) || 'null') } catch { saved = null }
  if (saved?.id) await deleteDoc(doc(db, 'users', uid, 'deviceTokens', saved.id))
  globalThis.localStorage?.removeItem(tokenKey(uid))
  if (forgetPreference) globalThis.localStorage?.removeItem(preferenceKey(uid))
  try { await PushNotifications.unregister() } catch { /* The Firestore token removal is the security boundary. */ }
  return true
}

export const setPushEnabledPreference = (uid, enabled) => {
  if (!uid) return
  if (enabled) globalThis.localStorage?.setItem(preferenceKey(uid), 'true')
  else globalThis.localStorage?.removeItem(preferenceKey(uid))
}

export const requestAndroidPushRegistration = async () => {
  if (!isAndroidPushSupported()) throw new Error('Push notifications are available in the Android app.')
  let permission = await PushNotifications.checkPermissions()
  if (permission.receive !== 'granted') permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return false
  // Android channels are immutable once created. These versioned channels
  // replace the legacy channel without deleting or altering user settings.
  await Promise.all([
    PushNotifications.createChannel({
      id: PUSH_CHANNELS.audible,
      name: 'Trip updates',
      description: 'Trip updates using Android’s standard notification sound',
      importance: 3,
      vibration: true,
    }),
    PushNotifications.createChannel({
      id: PUSH_CHANNELS.silent,
      name: 'Silent trip updates',
      description: 'Silent trip updates',
      importance: 2,
      vibration: false,
    }),
  ])
  await PushNotifications.register()
  return true
}
