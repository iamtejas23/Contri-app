import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { db } from '../firebase/config'
import { getErrorMessage } from '../lib/errors'

const defaultState = {
  tripId: null,
  trip: null,
  expenses: [],
  settlements: [],
  activity: [],
  loading: true,
  notFound: false,
}

export const useTripData = (tripId) => {
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

    const unsubscribeTrip = onSnapshot(
      doc(db, 'trips', tripId),
      (snapshot) => {
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
        toast.error(getErrorMessage(error, 'We could not load that trip.'))
        markReady('trip')
      },
    )

    const unsubscribeExpenses = onSnapshot(
      query(collection(db, 'trips', tripId, 'expenses'), orderBy('date', 'desc')),
      (snapshot) => {
        updateForTrip((current) => ({
          ...current,
          expenses: snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        }))
        markReady('expenses')
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load trip expenses.'))
        markReady('expenses')
      },
    )

    const unsubscribeSettlements = onSnapshot(
      query(collection(db, 'trips', tripId, 'settlements'), orderBy('settledAt', 'desc')),
      (snapshot) => {
        updateForTrip((current) => ({
          ...current,
          settlements: snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        }))
        markReady('settlements')
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load settlements.'))
        markReady('settlements')
      },
    )

    const unsubscribeActivity = onSnapshot(
      query(collection(db, 'trips', tripId, 'activity'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        updateForTrip((current) => ({
          ...current,
          activity: snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        }))
        markReady('activity')
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load activity.'))
        markReady('activity')
      },
    )

    return () => {
      unsubscribeTrip()
      unsubscribeExpenses()
      unsubscribeSettlements()
      unsubscribeActivity()
    }
  }, [tripId])

  if (!tripId) {
    return {
      ...defaultState,
      loading: false,
    }
  }

  if (state.tripId !== tripId) {
    return {
      ...defaultState,
      tripId,
    }
  }

  return state
}
