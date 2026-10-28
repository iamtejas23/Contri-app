import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { db } from '../firebase/config'
import { sortRecordsByDate } from '../lib/date'
import { getErrorMessage } from '../lib/errors'

export const useUserTrips = (uid) => {
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState({
    uid: null,
    trips: [],
    error: '',
    loading: true,
  })

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const tripSources = { memberships: new Map(), ownership: new Map() }
    const sourceErrors = {}
    const sourceReady = { memberships: false, ownership: false }
    const publish = () => {
      const uniqueTrips = new Map([
        ...tripSources.memberships,
        ...tripSources.ownership,
      ])
      const messages = Object.values(sourceErrors)
      setState({
        uid,
        trips: sortRecordsByDate([...uniqueTrips.values()], ['createdAt', 'updatedAt']),
        error: messages.join(' '),
        loading: !Object.values(sourceReady).every(Boolean),
      })
    }
    const subscribe = (source, tripQuery) => onSnapshot(
      tripQuery,
      (snapshot) => {
        tripSources[source] = new Map(snapshot.docs.map((item) => [item.id, {
          id: item.id,
          ...item.data(),
        }]))
        delete sourceErrors[source]
        sourceReady[source] = true
        publish()
      },
      (error) => {
        sourceErrors[source] = `${source === 'ownership' ? 'Older trips' : 'Trips'}: ${getErrorMessage(error, 'We could not load your trips.')}`
        sourceReady[source] = true
        publish()
      },
    )

    const unsubscribeMemberships = subscribe(
      'memberships',
      query(collection(db, 'trips'), where('memberIds', 'array-contains', uid)),
    )
    const unsubscribeOwnership = subscribe(
      'ownership',
      query(collection(db, 'trips'), where('createdBy', '==', uid)),
    )

    return () => {
      unsubscribeMemberships()
      unsubscribeOwnership()
    }
  }, [uid, retryCount])

  const retry = () => {
    setState((current) => current.uid === uid
      ? { ...current, loading: true, error: '', trips: [] }
      : current)
    setRetryCount((count) => count + 1)
  }

  return {
    trips: state.uid === uid ? state.trips : [],
    loading: Boolean(uid) && (state.uid !== uid || state.loading),
    error: state.uid === uid ? state.error : '',
    retry,
  }
}
