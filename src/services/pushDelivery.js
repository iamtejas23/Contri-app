import { Capacitor } from '@capacitor/core'

import { auth } from '../firebase/config'

const getPushApiBase = () => {
  const configured = import.meta.env.VITE_PUSH_API_BASE_URL || import.meta.env.VITE_RECEIPT_API_BASE_URL
  if (configured) return configured.replace(/\/$/, '')
  if (!Capacitor.isNativePlatform()) return globalThis.location?.origin || ''
  return 'https://contri-app.vercel.app'
}

// Call only after the existing business write commits. Push delivery is a
// secondary side effect and must never make a saved expense appear unsaved.
export const requestPushDelivery = async ({ tripId, eventId, eventType }) => {
  const user = auth.currentUser
  const base = getPushApiBase()
  if (!user || user.isAnonymous || !base || !tripId || !eventId || !eventType) return false
  try {
    const token = await user.getIdToken()
    const response = await fetch(`${base}/api/push/dispatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, eventId, eventType }),
    })
    if (!response.ok) {
      // Keep safe status-only diagnostics. The endpoint response contains no credentials.
      console.warn('[push-delivery-client]', { status: response.status })
      return false
    }
    return true
  } catch {
    console.warn('[push-delivery-client]', { stage: 'network' })
    return false
  }
}
