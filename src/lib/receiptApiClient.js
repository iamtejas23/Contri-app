const getToken = async (user, forceRefresh = false) => {
  if (!user) throw new Error('Sign in before managing receipts.')

  try {
    return await user.getIdToken(forceRefresh)
  } catch {
    throw new Error(forceRefresh
      ? 'Firebase could not refresh this session. Check your connection and retry.'
      : 'Firebase could not read the current session. Wait for sign-in to finish, then retry.')
  }
}

export const requestReceiptApiWithAuth = async ({ user, url, payload, fetchImpl = fetch }) => {
  const refreshableAuthCodes = new Set(['FIREBASE_TOKEN_EXPIRED', 'FIREBASE_TOKEN_INVALID'])
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getToken(user, attempt === 1)
    let response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch {
      throw new Error('Receipt service is unreachable. Check your connection and retry the same image.')
    }

    const result = await response.json().catch(() => ({}))
    if (response.status === 401 && attempt === 0 && refreshableAuthCodes.has(result.code)) continue
    if (!response.ok) {
      const message = result.error || 'The receipt request failed. Please try again.'
      const diagnostic = [result.code, result.requestId].filter(Boolean).join(' · ')
      const error = new Error(diagnostic ? `${message} (${diagnostic})` : message)
      error.code = result.code
      error.requestId = result.requestId
      throw error
    }
    return result
  }

  throw new Error('The refreshed Firebase session was rejected. Check your connection, then sign in again if the problem continues.')
}
