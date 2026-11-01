import { randomUUID } from 'node:crypto'
import { assertAuthorizedCreator, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { createUploadAuth } from '../_lib/imagekit.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'
import process from 'node:process'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const mimeType = String(body.mimeType || '').toLowerCase()
    if (!ALLOWED_TYPES.has(mimeType)) return respond(response, 400, { error: 'Choose a JPEG, PNG or WebP image.' })

    const fetchImpl = dependencies.fetchImpl || fetch
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertAuthorizedCreator(trip, identity)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    if (!expense) return respond(response, 404, { error: 'This expense could not be found.' })
    if (process.env.IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED !== 'true') {
      return respond(response, 503, { error: 'Receipt uploads are disabled until the ImageKit private upload policy is verified.' })
    }

    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[mimeType]
    const fileName = `receipt-${randomUUID()}.${extension}`
    const folder = `/contri-receipts/${tripId}/${expenseId}`
    return respond(response, 200, {
      ...createUploadAuth(),
      folder,
      fileName,
      isPrivateFile: true,
      useUniqueFileName: true,
      mimeType,
    })
  }, dependencies)
}
