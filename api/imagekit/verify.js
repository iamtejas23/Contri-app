import { assertAuthorizedCreator, getFirestoreDocument, validateDocumentId } from '../_lib/firebase.js'
import { deleteImageKitFile, getImageKitFileDetails } from '../_lib/imagekit.js'
import { respond } from '../_lib/http.js'
import { withReceiptApi } from '../_lib/receiptApi.js'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

export default async function handler(req, res, dependencies = {}) {
  return withReceiptApi(req, res, async ({ res: response, body, idToken, identity, dependencies }) => {
    const tripId = validateDocumentId(body.tripId, 'trip ID')
    const expenseId = validateDocumentId(body.expenseId, 'expense ID')
    const fileId = String(body.fileId || '')
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(fileId)) return respond(response, 400, { error: 'A valid receipt ID is required.' })

    const fetchImpl = dependencies.fetchImpl || fetch
    const trip = await getFirestoreDocument(`trips/${tripId}`, idToken, fetchImpl)
    assertAuthorizedCreator(trip, identity)
    const expense = await getFirestoreDocument(`trips/${tripId}/expenses/${expenseId}`, idToken, fetchImpl)
    if (!expense) return respond(response, 404, { error: 'This expense could not be found.' })

    const details = await getImageKitFileDetails(fileId, fetchImpl)
    const expectedPathPrefix = `/contri-receipts/${tripId}/${expenseId}/`
    const actualPath = typeof details.filePath === 'string' ? `/${details.filePath.replace(/^\/+/, '')}` : ''
    const valid = details.fileId === fileId
      && details.isPrivateFile === true
      && actualPath.startsWith(expectedPathPrefix)
      && ALLOWED_TYPES.has(String(details.mime || '').toLowerCase())
      && Number.isFinite(details.size)
      && details.size > 0
      && details.size <= MAX_FILE_SIZE

    if (!valid) {
      // Only clean up when ImageKit confirms this is the exact file in this
      // authenticated creator's expected receipt folder. Never delete an
      // unrelated asset based only on a client-supplied file ID.
      if (details.fileId === fileId && actualPath.startsWith(expectedPathPrefix)) {
        try {
          await deleteImageKitFile(fileId, fetchImpl)
        } catch {
          return respond(response, 502, { error: 'The uploaded file failed privacy checks and could not be safely removed. Contact support before retrying.' })
        }
      }
      return respond(response, 400, { error: 'The uploaded file did not pass receipt privacy and format checks and was not attached.' })
    }

    return respond(response, 200, {
      receipt: {
        fileId,
        filePath: actualPath,
        fileName: String(details.name || 'receipt').slice(0, 180),
        mimeType: String(details.mime).toLowerCase(),
        size: details.size,
      },
    })
  }, dependencies)
}
