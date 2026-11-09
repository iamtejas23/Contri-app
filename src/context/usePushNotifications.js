import { useContext } from 'react'

import { PushNotificationsContext } from './push-notifications-context'

export const usePushNotifications = () => {
  const context = useContext(PushNotificationsContext)
  if (!context) throw new Error('usePushNotifications must be used inside PushNotificationsProvider.')
  return context
}
