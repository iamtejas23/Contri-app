import { getBearerToken, verifyFirebaseIdentity } from './firebase.js'
import { handleOptions, readJsonBody, respond, setCors } from './http.js'

export const withReceiptApi = async (req, res, handler, dependencies = {}) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return handleOptions(req, res)
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' })

  try {
    const idToken = getBearerToken(req)
    const identity = await verifyFirebaseIdentity(idToken, dependencies.fetchImpl || fetch)
    let body
    try {
      body = readJsonBody(req)
    } catch {
      return respond(res, 400, { error: 'Request body must be valid JSON.' })
    }
    return await handler({ req, res, body, idToken, identity, dependencies })
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500
    if (status >= 500) console.error('Receipt API request failed:', error.message)
    return respond(res, status, { error: status >= 500 ? 'Receipt service is temporarily unavailable.' : error.message })
  }
}
