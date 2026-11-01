import { assertTripMember, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { createReceiptStorage, getReceiptFile } from '../_lib/supabase.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'

const signedUrl = async (storage, receipt, download) => {
  const options = download ? { download: receipt.fileName || 'receipt' } : undefined
  const { data, error } = await storage.createSignedUrl(receipt.path, 120, options)
  if (error || !data?.signedUrl) throw Object.assign(new Error('The private receipt could not be opened.'), { statusCode: 502 })
  return data.signedUrl
}

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies: deps }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const fileId = validateDocumentId(body.fileId, 'receipt ID')
    const fetchImpl = deps.fetchImpl || fetch
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertTripMember(trip, identity.uid)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    const receipt = getReceiptFile(expense, fileId, tripId, expenseId)
    const storage = (deps.createStorage || createReceiptStorage)({ fetchImpl: deps.supabaseFetchImpl })
    const [preview, download] = await Promise.all([
      signedUrl(storage, receipt, false),
      signedUrl(storage, receipt, true),
    ])
    return respond(response, 200, {
      preview,
      thumbnail: preview,
      original: preview,
      download,
      mimeType: receipt.mimeType,
      expiresIn: 120,
    })
  }, dependencies)
}
