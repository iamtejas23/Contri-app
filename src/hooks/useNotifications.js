import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { db } from '../firebase/config'
import { getErrorMessage } from '../lib/errors'
import { createNotificationArrivalDetector, prepareNotificationSound } from '../lib/notificationSound'

const initialState = { uid: null, notifications: [], unreadCount: 0, error: '' }

export const useNotifications = (uid) => {
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState(initialState)

  const dismissNotifications = ({ notificationIds, deletedUnreadCount }) => {
    const removedIds = new Set(notificationIds)
    setState((current) => {
      if (current.uid !== uid) return current
      return {
        ...current,
        notifications: current.notifications.filter((notification) => !removedIds.has(notification.id)),
        unreadCount: Math.max(0, current.unreadCount - deletedUnreadCount),
      }
    })
  }

  useEffect(() => {
    if (!uid) return undefined

    let listReady = false
    let unreadReady = false
    let notifications = []
    let unreadCount = 0
    const ref = collection(db, 'users', uid, 'notifications')
    const detectNotificationArrivals = createNotificationArrivalDetector(uid)
    let audioPreparationPending = false

    const prepareAudioAfterInteraction = () => {
      if (audioPreparationPending) return
      audioPreparationPending = true
      void prepareNotificationSound().finally(() => {
        audioPreparationPending = false
      })
    }

    // A persisted preference survives reloads, but the browser's AudioContext does not.
    // Prepare it only from a real user gesture so later Firestore callbacks can play safely.
    window.addEventListener('pointerdown', prepareAudioAfterInteraction, { capture: true, passive: true })
    window.addEventListener('keydown', prepareAudioAfterInteraction, true)

    const publish = (error = '') => {
      setState({
        uid,
        notifications,
        unreadCount,
        error,
        loading: !(listReady && unreadReady),
      })
    }

    const stopList = onSnapshot(
      query(ref, orderBy('createdAt', 'desc'), limit(40)),
      { includeMetadataChanges: true },
      (snapshot) => {
        detectNotificationArrivals(snapshot)
        notifications = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        listReady = true
        publish()
      },
      (error) => {
        listReady = true
        publish(getErrorMessage(error, 'Notifications could not be loaded.'))
      },
    )

    const stopUnread = onSnapshot(
      query(ref, where('read', '==', false)),
      (snapshot) => {
        unreadCount = snapshot.size
        unreadReady = true
        publish()
      },
      (error) => {
        unreadReady = true
        publish(getErrorMessage(error, 'Unread notifications could not be counted.'))
      },
    )

    return () => {
      window.removeEventListener('pointerdown', prepareAudioAfterInteraction, true)
      window.removeEventListener('keydown', prepareAudioAfterInteraction, true)
      stopList()
      stopUnread()
    }
  }, [retryCount, uid])

  return {
    notifications: uid && state.uid === uid ? state.notifications : [],
    unreadCount: uid && state.uid === uid ? state.unreadCount : 0,
    loading: Boolean(uid) && (state.uid !== uid || state.loading !== false),
    error: uid && state.uid === uid ? state.error : '',
    retry: () => setRetryCount((count) => count + 1),
    dismissNotifications,
  }
}
