import { signInAnonymously, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

export const createGuestSession = async ({ auth, database, name, contactEmail = '' }) => {
  const safeName = name.trim()
  const safeContactEmail = contactEmail.trim().toLowerCase()
  if (!safeName) throw new Error('Enter your name to continue as a guest.')

  let user = auth.currentUser
  if (user && !user.isAnonymous) {
    throw new Error('Sign out of your current account before creating a guest account.')
  }
  if (!user) user = (await signInAnonymously(auth)).user

  await updateProfile(user, { displayName: safeName })
  await setDoc(
    doc(database, 'users', user.uid),
    {
      name: safeName,
      email: user.email?.toLowerCase() || '',
      contactEmail: safeContactEmail,
      photoURL: user.photoURL || '',
      isGuest: true,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )
  return user
}
