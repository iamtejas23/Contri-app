import { assertTripAdmin, assertTripMember, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { createReceiptStorage, getReceiptFile } from '../_lib/supabase.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies: deps }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const fileId = validateDocumentId(body.fileId, 'receipt ID')
    const fetchImpl = deps.fetchImpl || fetch
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertTripMember(trip, identity.uid)
    assertTripAdmin(trip, identity.uid)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    const receipt = getReceiptFile(expense, fileId, tripId, expenseId)
    const storage = (deps.createStorage || createReceiptStorage)({ fetchImpl: deps.supabaseFetchImpl })
    const paths = [receipt.path, ...(receipt.thumbnailPath ? [receipt.thumbnailPath] : [])]
    const { error } = await storage.remove(paths)
    if (error) throw Object.assign(new Error('Supabase could not delete this receipt.'), { statusCode: 502 })
    return respond(response, 200, { deleted: true, fileId })
  }, dependencies)
}
