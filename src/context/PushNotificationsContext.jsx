import { App as CapacitorApp } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import {
  isAndroidPushSupported,
  isPushEnabled,
  removeOwnPushToken,
  requestAndroidPushRegistration,
  saveOwnPushToken,
  setPushEnabledPreference,
} from '../services/pushNotifications'
import { getPushDestination } from '../lib/pushNavigation'
import { PushNotificationsContext } from './push-notifications-context'

export const PushNotificationsProvider = ({ user, children }) => {
  const navigate = useNavigate()
  const supported = isAndroidPushSupported()
  const [enabledState, setEnabledState] = useState({ uid: null, value: false })
  const enabled = user?.uid && enabledState.uid === user.uid
    ? enabledState.value
    : Boolean(user?.uid && !user.isAnonymous && isPushEnabled(user.uid))
  const [permission, setPermission] = useState('prompt')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return undefined
    let active = true
    const onAction = (event) => {
      if (!active || !event?.notification?.data) return
      const target = getPushDestination(event.notification.data)
      if (target) navigate(target)
      else navigate('/')
    }
    let actionHandle
    void PushNotifications.addListener('pushNotificationActionPerformed', onAction).then((handle) => {
      if (active) actionHandle = handle
      else handle.remove()
    }).catch(() => {})

    return () => {
      active = false
      actionHandle?.remove()
    }
  }, [navigate, supported])

  useEffect(() => {
    if (!supported || !user?.uid || user.isAnonymous) return undefined
    let active = true
    let handles = []
    const onToken = (token) => {
      if (active && isPushEnabled(user.uid)) {
        void saveOwnPushToken(user.uid, token.value).catch(() => toast.error('Push token could not be saved. Check your connection.'))
      }
    }
    const onRegistrationError = () => {
      if (active) toast.error('Contri could not register this device for push notifications.')
    }
    void Promise.all([
      PushNotifications.addListener('registration', onToken),
      PushNotifications.addListener('registrationError', onRegistrationError),
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive && isPushEnabled(user.uid)) void requestAndroidPushRegistration().catch(() => {})
      }),
    ]).then((listenerHandles) => {
      if (active) handles = listenerHandles
      else listenerHandles.forEach((handle) => handle.remove())
      return PushNotifications.checkPermissions()
    }).then((result) => {
      if (active) setPermission(result.receive || 'prompt')
      if (active && isPushEnabled(user.uid) && result.receive === 'granted') {
        void requestAndroidPushRegistration().catch(() => {})
      }
    }).catch(() => {})
    return () => {
      active = false
      handles.forEach((handle) => handle.remove())
    }
  }, [supported, user?.isAnonymous, user?.uid])

  const enable = async () => {
    if (!supported || !user?.uid || user.isAnonymous) return false
    setBusy(true)
    try {
      setPushEnabledPreference(user.uid, true)
      const granted = await requestAndroidPushRegistration()
      const result = await PushNotifications.checkPermissions()
      setPermission(result.receive || 'prompt')
      if (!granted) {
        setPushEnabledPreference(user.uid, false)
        setEnabledState({ uid: user.uid, value: false })
        return false
      }
      setPushEnabledPreference(user.uid, true)
      setEnabledState({ uid: user.uid, value: true })
      return true
    } catch (error) {
      setPushEnabledPreference(user.uid, false)
      setEnabledState({ uid: user.uid, value: false })
      throw error
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!user?.uid || user.isAnonymous) return
    setBusy(true)
    try {
      setPushEnabledPreference(user.uid, false)
      await removeOwnPushToken(user.uid)
      setEnabledState({ uid: user.uid, value: false })
    } catch (error) {
      setPushEnabledPreference(user.uid, true)
      throw error
    } finally {
      setBusy(false)
    }
  }

  const value = { supported, enabled, permission, busy, enable, disable }
  return <PushNotificationsContext.Provider value={value}>{children}</PushNotificationsContext.Provider>
}
