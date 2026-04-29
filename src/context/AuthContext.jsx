import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

import { auth, db } from '../firebase/config'
import {
  ensureUserProfile,
  loginWithEmail,
  loginWithGoogle,
  logoutUser,
  registerWithEmail,
} from '../services/auth'
import { updateUserProfileDoc } from '../services/users'
import { AuthContext } from './auth-context'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeProfile = () => {}

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      unsubscribeProfile()

      if (!nextUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(nextUser)

      try {
        await ensureUserProfile(nextUser)
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', nextUser.uid),
          (snapshot) => {
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
            setProfile(null)
            setLoading(false)
          },
        )
      } catch {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth()
      unsubscribeProfile()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      register: registerWithEmail,
      login: loginWithEmail,
      loginWithGoogle,
      logout: logoutUser,
      updateProfileDetails: async ({ name, photoURL }) => {
        if (!user) {
          return
        }

        await updateUserProfileDoc({
          uid: user.uid,
          name,
          photoURL,
        })
      },
    }),
    [loading, profile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
