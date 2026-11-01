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
    const fileId = validateDocumentId(body.fileId, 'receipt ID')
    const mimeType = String(body.mimeType || '').toLowerCase()
    if (!RECEIPT_TYPES.has(mimeType) || body.path !== `trips/${tripId}/expenses/${expenseId}/${fileId}.${extensions[mimeType]}`) {
      return respond(response, 400, { error: 'The uploaded receipt path or format is invalid.' })
    }
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, deps.fetchImpl || fetch)
    assertAuthorizedCreator(trip, identity)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, deps.fetchImpl || fetch)
    if (!expense) return respond(response, 404, { error: 'This expense could not be found.' })

    const storage = (deps.createStorage || createReceiptStorage)({ fetchImpl: deps.supabaseFetchImpl })
    const { data, error } = await storage.info(body.path)
    if (error || !data) {
      const statusCode = Number(error?.statusCode || error?.status)
      if (statusCode === 413) return respond(response, 413, { error: 'Supabase rejected this image because it exceeds the bucket’s 5 MB limit.' })
      if (statusCode === 400) return respond(response, 400, { error: error.message || 'Supabase rejected this image. Check the bucket’s 5 MB limit and JPEG, PNG or WebP type restrictions.' })
      return respond(response, 400, { error: 'The upload is incomplete or the file could not be verified. Retry the same image.' })
    }
    const actualType = String(data.contentType || '').toLowerCase()
    const size = Number(data.size)
    if (actualType !== mimeType || !Number.isFinite(size) || size <= 0 || size > MAX_RECEIPT_BYTES) {
      return respond(response, 400, { error: 'The uploaded file did not pass the receipt type and size checks.' })
    }
    return respond(response, 200, {
      receipt: {
        provider: 'supabase', bucket: RECEIPT_BUCKET, fileId, path: body.path,
        fileName: safeFileName(body.fileName), mimeType: actualType, size,
      },
    })
  }, dependencies)
}
