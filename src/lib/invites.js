export const getTripIdFromInvite = (value) => {
  const invite = value?.trim()
  if (!invite) return ''

  if (invite.startsWith('/') || invite.startsWith('?') || /^[a-z][a-z\d+.-]*:\/\//i.test(invite)) {
    try {
      const url = new URL(invite, typeof window === 'undefined' ? 'https://contri.invalid' : window.location.origin)
      const pathMatch = url.pathname.match(/\/join\/([^/]+)\/?$/i)
      const tripId = (url.searchParams.get('tripId') || (pathMatch ? decodeURIComponent(pathMatch[1]) : '')).trim()
      return tripId && !tripId.includes('/') ? tripId : ''
    } catch {
      return ''
    }
  }

  // Contri's current invite code is the existing Firestore trip document ID.
  return invite.includes('/') ? '' : invite
}

export const buildTripInviteLink = (tripId, origin = typeof window === 'undefined' ? 'https://contri-app.vercel.app' : window.location.origin) => {
  if (!tripId || typeof tripId !== 'string' || tripId.includes('/')) return ''
  return `${origin.replace(/\/$/, '')}/join/${encodeURIComponent(tripId)}`
}
