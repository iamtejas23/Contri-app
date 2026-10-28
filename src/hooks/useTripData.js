import {
  collection,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { db } from '../firebase/config'
import { sortRecordsByDate } from '../lib/date'
import { getErrorMessage } from '../lib/errors'

const defaultState = {
  tripId: null,
  trip: null,
  expenses: [],
  settlements: [],
  activity: [],
  loading: true,
  notFound: false,
  error: '',
}

export const useTripData = (tripId) => {
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState(defaultState)

  useEffect(() => {
    if (!tripId) {
      return undefined
    }

    const ready = {
      trip: false,
      expenses: false,
      settlements: false,
      activity: false,
    }
    const streamErrors = {}
    const nextBaseState = {
      ...defaultState,
      tripId,
    }
    const updateForTrip = (updater) => {
      setState((current) => {
        const base = current.tripId === tripId ? current : nextBaseState
        return updater(base)
      })
    }
    const markReady = (key) => {
      ready[key] = true

      if (Object.values(ready).every(Boolean)) {
        updateForTrip((current) => ({ ...current, loading: false }))
      }
    }
    const clearStreamError = (key) => {
      delete streamErrors[key]
      updateForTrip((current) => ({ ...current, error: Object.values(streamErrors).join(' ') }))
    }
    const recordStreamError = (key, error, fallback) => {
      streamErrors[key] = getErrorMessage(error, fallback)
      updateForTrip((current) => ({
        ...current,
        ...(key === 'trip' ? {} : { [key]: [] }),
        error: Object.values(streamErrors).join(' '),
      }))
      markReady(key)
    }

    const unsubscribeTrip = onSnapshot(
      doc(db, 'trips', tripId),
      (snapshot) => {
        clearStreamError('trip')
        updateForTrip((current) => ({
          ...current,
          trip: snapshot.exists()
            ? {
                id: snapshot.id,
                ...snapshot.data(),
              }
            : null,
          notFound: !snapshot.exists(),
        }))
        markReady('trip')
      },
      (error) => {
        const message = getErrorMessage(error, 'We could not load that trip.')
        toast.error(message)
        recordStreamError('trip', error, 'We could not load that trip.')
      },
    )

    const unsubscribeExpenses = onSnapshot(
      query(collection(db, 'trips', tripId, 'expenses')),
      (snapshot) => {
        clearStreamError('expenses')
        updateForTrip((current) => ({
          ...current,
          expenses: sortRecordsByDate(snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })), ['date', 'createdAt', 'updatedAt']),
        }))
        markReady('expenses')
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load trip expenses.'))
        recordStreamError('expenses', error, 'We could not load trip expenses.')
      },
    )

    const unsubscribeSettlements = onSnapshot(
      query(collection(db, 'trips', tripId, 'settlements')),
      (snapshot) => {
        clearStreamError('settlements')
        updateForTrip((current) => ({
          ...current,
          settlements: sortRecordsByDate(snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })), ['settledAt', 'createdAt', 'updatedAt']),
        }))
        markReady('settlements')
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load settlements.'))
        recordStreamError('settlements', error, 'We could not load settlements.')
      },
    )

    const unsubscribeActivity = onSnapshot(
      query(collection(db, 'trips', tripId, 'activity')),
      (snapshot) => {
        clearStreamError('activity')
        updateForTrip((current) => ({
          ...current,
          activity: sortRecordsByDate(snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })), ['timestamp', 'createdAt']),
        }))
        markReady('activity')
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load activity.'))
        recordStreamError('activity', error, 'We could not load activity.')
      },
    )

    return () => {
      unsubscribeTrip()
      unsubscribeExpenses()
      unsubscribeSettlements()
      unsubscribeActivity()
    }
  }, [retryCount, tripId])

  const retry = () => {
    setState((current) => current.tripId === tripId
      ? { ...current, loading: true, error: '', expenses: [], settlements: [], activity: [] }
      : current)
    setRetryCount((count) => count + 1)
  }

  if (!tripId) {
    return {
      ...defaultState,
      loading: false,
      retry,
    }
  }

  if (state.tripId !== tripId) {
    return {
      ...defaultState,
      tripId,
      retry,
    }
  }

  return { ...state, retry }
}
