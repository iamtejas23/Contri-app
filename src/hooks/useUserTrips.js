import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { db } from '../firebase/config'
import { toDateValue } from '../lib/date'
import { getErrorMessage } from '../lib/errors'

export const useUserTrips = (uid) => {
  const [state, setState] = useState({
    uid: null,
    trips: [],
  })

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'trips'), where('memberIds', 'array-contains', uid)),
      (snapshot) => {
        const nextTrips = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort((first, second) => {
            const firstDate = toDateValue(first.createdAt)?.getTime() || 0
            const secondDate = toDateValue(second.createdAt)?.getTime() || 0
            return secondDate - firstDate
          })

        setState({
          uid,
          trips: nextTrips,
        })
      },
      (error) => {
        toast.error(getErrorMessage(error, 'We could not load your trips.'))
        setState({
          uid,
          trips: [],
        })
      },
    )

    return unsubscribe
  }, [uid])

  return {
    trips: state.uid === uid ? state.trips : [],
    loading: Boolean(uid) && state.uid !== uid,
  }
}
