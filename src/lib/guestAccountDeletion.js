export const GUEST_DELETION_CONFIRMATION = 'DELETE'
const ENDPOINT = '/api/auth/delete-guest'

let deletionInFlight = null

export const canRequestGuestDeletion = (user) => Boolean(user?.uid && user.isAnonymous === true)

export const guestDeletionConfirmationMatches = (value) => value === GUEST_DELETION_CONFIRMATION

export const completeGuestDeletionSession = async ({ result, signOutImpl, clearLocalSession, navigate }) => {
  if (result?.authDeleted !== true) {
    throw new Error('The guest account was not deleted.')
  }
  clearLocalSession()
  try { await signOutImpl() } catch { /* The deleted account no longer has a session. */ }
  navigate('/login', { replace: true })
}

export const deleteCurrentGuestAccount = async ({ user, fetchImpl = fetch } = {}) => {
  if (!user) throw new Error('Sign in with the guest account before deleting it.')
  if (user.isAnonymous !== true) throw new Error('Only a guest account can be deleted this way.')
  if (deletionInFlight) return deletionInFlight

  deletionInFlight = (async () => {
    let token
    try {
      token = await user.getIdToken()
    } catch {
      throw new Error('The Firebase session expired. Sign in again and retry.')
    }
    let response
    try {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch {
      throw new Error('Guest account deletion is unreachable. Check your connection and try again.')
    }
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.authDeleted !== true) {
      const error = new Error(result.error || 'The guest account could not be deleted.')
      error.code = result.code
      error.authDeleted = false
      error.cleanup = result.cleanup
      throw error
    }
    return result
  })().finally(() => {
    deletionInFlight = null
  })

  return deletionInFlight
}
