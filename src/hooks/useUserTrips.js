import { onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { db } from '../firebase/config'
import { getErrorMessage } from '../lib/errors'
import { getUserTripQueries, mergeUserTripSources, tripsFromSnapshot } from '../lib/userTrips'

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

    const tripSources = { memberships: [], ownership: [] }
    const sourceErrors = {}
    const sourceReady = { memberships: false, ownership: false }
    const publish = () => {
      const messages = Object.values(sourceErrors)
      setState({
        uid,
        trips: mergeUserTripSources(tripSources),
        error: messages.join(' '),
        loading: !Object.values(sourceReady).every(Boolean),
      })
    }
    const subscribe = (source, tripQuery) => onSnapshot(
      tripQuery,
      (snapshot) => {
        tripSources[source] = tripsFromSnapshot(snapshot).map((trip) => [trip.id, trip])
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

    const queries = getUserTripQueries(db, uid)
    const unsubscribeMemberships = subscribe('memberships', queries.memberships)
    const unsubscribeOwnership = subscribe('ownership', queries.ownership)

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
