import { Capacitor } from '@capacitor/core'
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { PushNotifications } from '@capacitor/push-notifications'

import { auth, db } from '../firebase/config'

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
  await setDoc(doc(db, 'users', uid, 'deviceTokens', id), {
    token,
    platform: 'android',
    updatedAt: serverTimestamp(),
  })
  if (previous?.id && previous.id !== id) {
    await deleteDoc(doc(db, 'users', uid, 'deviceTokens', previous.id))
  }
  globalThis.localStorage?.setItem(tokenKey(uid), JSON.stringify({ id, token }))
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
  await PushNotifications.createChannel({
    id: 'contri_updates',
    name: 'Trip updates',
    description: 'Updates from your Contri trips',
    importance: 3,
    vibration: true,
  })
  await PushNotifications.register()
  return true
}
