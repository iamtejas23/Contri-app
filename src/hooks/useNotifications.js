import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { db } from '../firebase/config'
import { getErrorMessage } from '../lib/errors'

const initialState = { uid: null, notifications: [], unreadCount: 0, error: '' }

export const useNotifications = (uid) => {
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState(initialState)

  useEffect(() => {
    if (!uid) return undefined

    let listReady = false
    let unreadReady = false
    let notifications = []
    let unreadCount = 0
    const ref = collection(db, 'users', uid, 'notifications')

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
      (snapshot) => {
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
  }
}
