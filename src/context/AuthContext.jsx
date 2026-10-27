import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

import { auth, db } from '../firebase/config'
import {
  createGuestAccount,
  ensureUserProfile,
  loginWithGoogle,
  loginWithNativeGoogle,
  logoutUser,
} from '../services/auth'
import { updateUserProfileDoc } from '../services/users'
import { AuthContext } from './auth-context'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeProfile = () => {}
    let generation = 0

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      const currentGeneration = ++generation
      unsubscribeProfile()
      setProfile(null)
      setLoading(true)

      if (!nextUser) {
        setUser(null)
        setLoading(false)
        return
      }

      setUser(nextUser)

      try {
        await ensureUserProfile(nextUser)
        if (currentGeneration !== generation) return
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', nextUser.uid),
          (snapshot) => {
            if (currentGeneration !== generation) return
            setProfile(
              snapshot.exists()
                ? {
                    uid: snapshot.id,
                    ...snapshot.data(),
                  }
                : null,
            )
            setLoading(false)
          },
          () => {
            if (currentGeneration !== generation) return
            setProfile(null)
            setLoading(false)
          },
        )
      } catch {
        if (currentGeneration !== generation) return
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      generation += 1
      unsubscribeAuth()
      unsubscribeProfile()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      loginWithGoogle,
      loginWithNativeGoogle,
      createGuestAccount,
      logout: logoutUser,
      updateProfileDetails: async ({ name, photoURL, upiId = '' }) => {
        if (!user) {
          return
        }

        await updateUserProfileDoc({
          uid: user.uid,
          name,
          photoURL,
          upiId,
        })
      },
    }),
    [loading, profile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
