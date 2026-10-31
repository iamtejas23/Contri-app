import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { db } from '../firebase/config'
import { subscribeToTripExpenseViews } from '../services/expenseViews.js'

export const useExpenseViews = (tripId) => {
  const [state, setState] = useState({ tripId: null, views: {} })

  useEffect(() => {
    if (!tripId) return undefined

    return subscribeToTripExpenseViews({
      database: db,
      tripId,
      onViews: (views) => setState({ tripId, views }),
      onError: () => toast.error('Seen-by information is temporarily unavailable.'),
    })
  }, [tripId])

  return state.tripId === tripId ? state.views : {}
}
