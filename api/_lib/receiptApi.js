import { randomUUID } from 'node:crypto'
import { getBearerToken, verifyFirebaseIdentity } from './firebase.js'
import { handleOptions, readJsonBody, respond, setCors } from './http.js'

export const withReceiptApi = async (req, res, handler, dependencies = {}) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return handleOptions(req, res)
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' })

  const requestId = randomUUID()
  let stage = 'authorization_header'
  try {
    const idToken = getBearerToken(req)
    stage = 'firebase_verification'
    const identity = await verifyFirebaseIdentity(idToken, dependencies.fetchImpl || fetch)
    stage = 'request_validation'
    let body
    try {
      body = readJsonBody(req)
    } catch {
      return respond(res, 400, { error: 'Request body must be valid JSON.' })
    }
    return await handler({ req, res, body, idToken, identity, dependencies, setStage: (value) => { stage = value } })
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500
    const code = error.code || (status >= 500 ? 'RECEIPT_SERVICE_ERROR' : status === 403 ? 'TRIP_AUTHORIZATION_FAILED' : 'RECEIPT_REQUEST_INVALID')
    // These structured diagnostics intentionally omit tokens, user identifiers,
    // request bodies, credentials, and provider response text.
    console.error(JSON.stringify({ event: 'receipt_api_error', requestId, stage, code, status, category: error.diagnosticCategory || undefined }))
    return respond(res, status, {
      error: status >= 500 ? (error.message || 'Receipt service is temporarily unavailable.') : error.message,
      code,
      requestId,
    })
  }
}
