import { randomUUID } from 'node:crypto'

import { deleteCurrentGuestAccount } from '../_lib/deleteGuestAccount.js'
import { getBearerToken } from '../_lib/firebase.js'
import { handleOptions, respond, setCors } from '../_lib/http.js'

export default async function handler(req, res, dependencies = {}) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return handleOptions(req, res)
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' })

  const requestId = randomUUID()
  try {
    const idToken = getBearerToken(req)
    const result = await deleteCurrentGuestAccount({ idToken, fetchImpl: dependencies.fetchImpl || fetch })
    if (result.authDeleted !== true) {
      return respond(res, 502, { error: 'The guest account could not be deleted.', code: 'GUEST_AUTH_DELETE_FAILED', requestId, authDeleted: false })
    }
    return respond(res, 200, { ...result, requestId })
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500
    return respond(res, status, {
      error: error.message || 'The guest account could not be deleted.',
      code: error.code || 'GUEST_DELETION_FAILED',
      requestId,
      authDeleted: false,
      ...(error.cleanup ? { cleanup: error.cleanup } : {}),
    })
  }
}
