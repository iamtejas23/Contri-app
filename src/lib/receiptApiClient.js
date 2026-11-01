const getFreshToken = async (user) => {
  if (!user) throw new Error('Sign in before managing receipts.')

  try {
    // Force Firebase Auth to refresh the token instead of reusing its cached ID token.
    return await user.getIdToken(true)
  } catch {
    throw new Error('Your sign-in session could not be refreshed. Check your connection and retry; you only need to sign in again if the session has expired.')
  }
}

export const requestReceiptApiWithAuth = async ({ user, url, payload, fetchImpl = fetch }) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getFreshToken(user)
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
    if (response.status === 401 && attempt === 0) continue
    if (!response.ok) throw new Error(result.error || 'The receipt request failed. Please try again.')
    return result
  }

  throw new Error('The refreshed Firebase session was rejected. Check your connection, then sign in again if the problem continues.')
}
