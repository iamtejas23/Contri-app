import { assertTripAdmin, assertTripMember, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { deleteImageKitFile, getImageKitFileDetails } from '../_lib/imagekit.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const fileId = String(body.fileId || '')
    if (!fileId || fileId.length > 250) return respond(response, 400, { error: 'A valid receipt ID is required.' })

    const fetchImpl = dependencies.fetchImpl || fetch
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertTripMember(trip, identity.uid)
    assertTripAdmin(trip, identity.uid)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    const receipt = expense?.receiptFiles?.[fileId]
    const expectedPathPrefix = `/contri-receipts/${tripId}/${expenseId}/`
    const normalizedPath = typeof receipt?.filePath === 'string' ? `/${receipt.filePath.replace(/^\/+/, '')}` : ''
    if (!receipt || receipt.fileId !== fileId || !normalizedPath.startsWith(expectedPathPrefix)) {
      return respond(response, 404, { error: 'This receipt is no longer attached to the expense.' })
    }

    const details = await getImageKitFileDetails(fileId, fetchImpl)
    const actualPath = typeof details.filePath === 'string' ? `/${details.filePath.replace(/^\/+/, '')}` : ''
    if (details.fileId !== fileId || details.isPrivateFile !== true || actualPath !== normalizedPath) {
      return respond(response, 404, { error: 'This private receipt could not be verified.' })
    }

    await deleteImageKitFile(fileId, fetchImpl)
    return respond(response, 200, { deleted: true, fileId })
  }, dependencies)
}
