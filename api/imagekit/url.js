import { assertTripMember, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { createSignedDeliveryUrl, createSignedDownloadUrl, getImageKitFileDetails } from '../_lib/imagekit.js'
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
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    const receipt = expense?.receiptFiles?.[fileId]
    const expectedPathPrefix = `/contri-receipts/${tripId}/${expenseId}/`
    const normalizedPath = typeof receipt?.filePath === 'string' ? `/${receipt.filePath.replace(/^\/+/, '')}` : ''
    if (!receipt || receipt.fileId !== fileId || !normalizedPath.startsWith(expectedPathPrefix)) {
      return respond(response, 404, { error: 'This receipt is no longer attached to the expense.' })
    }

    const imageDetails = await getImageKitFileDetails(fileId, fetchImpl)
    const verifiedPath = typeof imageDetails.filePath === 'string' ? `/${imageDetails.filePath.replace(/^\/+/, '')}` : ''
    if (imageDetails.fileId !== fileId || imageDetails.isPrivateFile !== true || verifiedPath !== normalizedPath) {
      return respond(response, 404, { error: 'This private receipt could not be verified.' })
    }

    const mimeType = String(imageDetails.mime || receipt.mimeType || '').toLowerCase()
    const image = mimeType.startsWith('image/')
    const preview = image
      ? createSignedDeliveryUrl({ filePath: normalizedPath, transformation: 'tr:w-960,q-82,f-webp' })
      : null
    const thumbnail = image
      ? createSignedDeliveryUrl({ filePath: normalizedPath, transformation: 'tr:w-360,q-70,f-webp' })
      : null
    const original = createSignedDeliveryUrl({ filePath: normalizedPath })
    const download = createSignedDownloadUrl({ filePath: normalizedPath })
    return respond(response, 200, { preview, thumbnail, original, download, mimeType })
  }, dependencies)
}
