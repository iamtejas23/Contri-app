import { assertCanUploadReceipt, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { MAX_RECEIPT_BYTES, MAX_RECEIPT_THUMBNAIL_BYTES, RECEIPT_BUCKET, RECEIPT_TYPES, createReceiptStorage } from '../_lib/supabase.js'
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
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies: deps, setStage }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const assetType = body.assetType === 'thumbnail' ? 'thumbnail' : 'original'
    const mimeType = String(body.mimeType || '').toLowerCase()
    const size = Number(body.size)
    if (assetType === 'thumbnail') {
      if (mimeType !== 'image/jpeg') return respond(response, 400, { error: 'Receipt thumbnails must be JPEG images.' })
      if (!Number.isFinite(size) || size <= 0 || size > MAX_RECEIPT_THUMBNAIL_BYTES) return respond(response, 400, { error: 'Receipt thumbnails must be no larger than 256 KB.' })
    } else {
      if (!RECEIPT_TYPES.has(mimeType)) return respond(response, 400, { error: 'Choose a JPEG, PNG or WebP image.' })
      if (!Number.isFinite(size) || size <= 0 || size > MAX_RECEIPT_BYTES) return respond(response, 400, { error: 'Receipt images must be 5 MB or smaller.' })
    }

    const fetchImpl = deps.fetchImpl || fetch
    setStage('trip_authorization')
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertCanUploadReceipt(trip, identity)
    setStage('expense_lookup')
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    if (!expense) return respond(response, 404, { error: 'This expense could not be found.' })

    const fileId = String(body.fileId || '')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fileId)) {
      return respond(response, 400, { error: 'A valid upload ID is required. Please select the image again.' })
    }
    const path = `trips/${tripId}/expenses/${expenseId}/${fileId}${assetType === 'thumbnail' ? '.thumb.jpg' : `.${extensions[mimeType]}`}`
    const storage = (deps.createStorage || createReceiptStorage)({ fetchImpl: deps.supabaseFetchImpl })
    setStage('supabase_existing_object_check')
    const existing = await storage.info(path)
    if (!existing.error && existing.data) {
      const actualType = String(existing.data.contentType || '').toLowerCase()
      const actualSize = Number(existing.data.size)
      const maxSize = assetType === 'thumbnail' ? MAX_RECEIPT_THUMBNAIL_BYTES : MAX_RECEIPT_BYTES
      if (actualType !== mimeType || actualSize !== size || actualSize > maxSize) {
        return respond(response, 409, { error: 'An upload already exists for this retry with different file details. Select the image again.' })
      }
      return respond(response, 200, {
        bucket: RECEIPT_BUCKET, fileId, path, fileName: safeFileName(body.fileName), mimeType, assetType,
        size: actualSize, alreadyUploaded: true,
      })
    }
    if (existing.error && Number(existing.error.statusCode) !== 404 && Number(existing.error.status) !== 404) {
      throw Object.assign(new Error('Supabase could not check whether this retry already uploaded the image.'), { statusCode: 502, code: 'SUPABASE_UPLOAD_FAILED' })
    }
    setStage('supabase_signed_upload_creation')
    const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token) throw Object.assign(new Error('Supabase could not create a secure upload token.'), { statusCode: 502, code: 'SUPABASE_UPLOAD_FAILED' })

    return respond(response, 200, {
      bucket: RECEIPT_BUCKET,
      fileId,
      path,
      token: data.token,
      fileName: safeFileName(body.fileName),
      mimeType,
      size,
      assetType,
    })
  }, dependencies)
}
