import { assertCanViewReceipt, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { createReceiptStorage, getReceiptFile } from '../_lib/supabase.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'

const signedUrl = async (storage, receipt, download, setStage, stage) => {
  setStage(stage)
  const options = download ? { download: receipt.fileName || 'receipt' } : undefined
  const { data, error } = await storage.createSignedUrl(receipt.path, 120, options)
  if (error || !data?.signedUrl) {
    const status = Number(error?.statusCode || error?.status)
    const category = status ? `HTTP_${status}` : (/^[A-Z0-9_-]{2,40}$/.test(String(error?.code || '')) ? String(error.code) : 'STORAGE_SIGN_REJECTED')
    const missing = status === 404 || /NOT.?FOUND/i.test(String(error?.code || ''))
    throw Object.assign(new Error(missing
      ? 'The private receipt file is missing from storage. Contact the trip admin; no data was changed.'
      : 'The private receipt link could not be created. Retry once; if it continues, share the request ID with support.'), {
      statusCode: missing ? 404 : 502,
      code: missing ? 'SUPABASE_OBJECT_MISSING' : 'SUPABASE_SIGNING_FAILED',
      diagnosticCategory: category,
    })
  }
  return data.signedUrl
}

const logOptionalSigningFailure = (requestId, stage, error) => {
  const category = error?.diagnosticCategory || (error?.code === 'SUPABASE_SIGNING_FAILED' ? 'STORAGE_SIGN_REJECTED' : 'OPTIONAL_LINK_UNAVAILABLE')
  console.warn(JSON.stringify({ event: 'receipt_optional_link_fallback', requestId, stage, code: 'SUPABASE_SIGNING_FAILED', category }))
}

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, requestId, dependencies: deps, setStage }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const fileId = validateDocumentId(body.fileId, 'receipt ID')
    const fetchImpl = deps.fetchImpl || fetch
    setStage('trip_membership_lookup')
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertCanViewReceipt(trip, identity)
    setStage('expense_receipt_lookup')
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    const receipt = getReceiptFile(expense, fileId, tripId, expenseId)
    const storage = (deps.createStorage || createReceiptStorage)({ fetchImpl: deps.supabaseFetchImpl })
    if (body.purpose === 'thumbnail') {
      let preview
      try {
        preview = await signedUrl(storage, receipt.thumbnailPath
          ? { ...receipt, path: receipt.thumbnailPath, fileName: 'receipt-thumbnail.jpg' }
          : receipt, false, setStage, receipt.thumbnailPath ? 'supabase_thumbnail_signing' : 'supabase_legacy_preview_signing')
      } catch (error) {
        if (!receipt.thumbnailPath) throw error
        // A missing/corrupt derivative must not make a valid private original inaccessible.
        logOptionalSigningFailure(requestId, 'supabase_thumbnail_signing', error)
        preview = await signedUrl(storage, receipt, false, setStage, 'supabase_original_fallback_signing')
      }
      return respond(response, 200, { thumbnail: preview, preview, mimeType: receipt.thumbnailMimeType || receipt.mimeType, expiresIn: 120 })
    }
    const preview = await signedUrl(storage, receipt, false, setStage, 'supabase_original_signing')
    let download = preview
    try { download = await signedUrl(storage, receipt, true, setStage, 'supabase_download_signing') } catch (error) {
      logOptionalSigningFailure(requestId, 'supabase_download_signing', error)
    }
    let thumbnail = preview
    if (receipt.thumbnailPath) {
      try { thumbnail = await signedUrl(storage, { ...receipt, path: receipt.thumbnailPath, fileName: 'receipt-thumbnail.jpg' }, false, setStage, 'supabase_thumbnail_signing') }
      catch (error) {
        logOptionalSigningFailure(requestId, 'supabase_thumbnail_signing', error)
      }
    }
    return respond(response, 200, {
      preview,
      thumbnail: thumbnail || preview,
      original: preview,
      download,
      mimeType: receipt.mimeType,
      expiresIn: 120,
    })
  }, dependencies)
}
