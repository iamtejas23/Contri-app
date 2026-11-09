const normalizeHost = (value) => String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase()

export const firebaseAuthHandlerUrl = (authDomain) => {
  const host = normalizeHost(authDomain)
  return host ? `https://${host}/__/auth/handler` : ''
}

// Google popup/redirect continue URIs are served from this project's Auth
// domain, not from the Vercel app origin. A leftover authDomain from another
// Firebase project is rejected as auth/invalid-continue-uri.
export const resolveFirebaseAuthDomain = (projectId, configuredAuthDomain) => {
  const project = String(projectId || '').trim()
  const expected = project ? `${project}.firebaseapp.com` : ''
  const configured = normalizeHost(configuredAuthDomain)
  if (!configured) return expected
  if (!project) return configured
  if (configured === `${project}.firebaseapp.com` || configured === `${project}.web.app`) {
    return configured
  }
  return expected
}
