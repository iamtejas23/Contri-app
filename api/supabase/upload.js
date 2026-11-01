import { randomUUID } from 'node:crypto'
import { assertAuthorizedCreator, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { MAX_RECEIPT_BYTES, RECEIPT_BUCKET, RECEIPT_TYPES, createReceiptStorage } from '../_lib/supabase.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const safeFileName = (value) => String(value || 'receipt')
  .replace(/[\\/]/g, '_')
  .split('')
  .map((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '_' : character)
  .join('')
  .slice(0, 160) || 'receipt'

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies: deps }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const mimeType = String(body.mimeType || '').toLowerCase()
    const size = Number(body.size)
    if (!RECEIPT_TYPES.has(mimeType)) return respond(response, 400, { error: 'Choose a JPEG, PNG or WebP image.' })
    if (!Number.isFinite(size) || size <= 0 || size > MAX_RECEIPT_BYTES) return respond(response, 400, { error: 'Receipt images must be 50 MB or smaller.' })

    const fetchImpl = deps.fetchImpl || fetch
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertAuthorizedCreator(trip, identity)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    if (!expense) return respond(response, 404, { error: 'This expense could not be found.' })

    const fileId = randomUUID()
    const path = `trips/${tripId}/expenses/${expenseId}/${fileId}.${extensions[mimeType]}`
    const storage = (deps.createStorage || createReceiptStorage)({ fetchImpl: deps.supabaseFetchImpl })
    const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token) throw Object.assign(new Error('Supabase could not create a secure upload token.'), { statusCode: 502 })

    return respond(response, 200, {
      bucket: RECEIPT_BUCKET,
      fileId,
      path,
      token: data.token,
      fileName: safeFileName(body.fileName),
      mimeType,
      size,
    })
  }, dependencies)
}
