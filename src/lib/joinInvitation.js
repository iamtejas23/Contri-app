import { doc, getDoc } from 'firebase/firestore'

import { logFirestoreOperationError } from './firestoreDiagnostics.js'
import { isActiveTripParticipant } from './receiptPermissions.js'
import {
  buildTripInvitationPreview,
  isValidTripInvitationPreview,
  loadTripInvitationPreview,
} from '../services/tripInvitationPreview.js'

export const isListedTripMember = (trip, uid) => Boolean(
  uid
  && Array.isArray(trip?.members)
  && trip.members.some((entry) => entry?.uid === uid),
)

export const isExistingTripParticipant = (trip, uid) => (
  isActiveTripParticipant(trip, { uid }) || isListedTripMember(trip, uid)
)

const isIgnorablePreviewError = (error) => (
  error?.code === 'permission-denied' || error?.code === 'not-found'
)

export const resolveJoinInvitation = async ({
  database,
  tripId,
  uid,
  loadPreview = loadTripInvitationPreview,
  readTrip = (nextDatabase, nextTripId) => getDoc(doc(nextDatabase, 'trips', nextTripId)),
  logError = logFirestoreOperationError,
} = {}) => {
  let preview = null
  let previewState = 'legacy'
  let previewError = ''
  let alreadyMember = false
  let trip = null

  try {
    const loaded = await loadPreview({ database, tripId })
    if (isValidTripInvitationPreview(loaded, tripId)) {
      preview = loaded
      previewState = 'ready'
    }
  } catch (error) {
    logError({
      operation: 'get',
      path: `trips/${tripId}/invitationPreview/current`,
      code: error?.code,
    })
    if (!isIgnorablePreviewError(error)) {
      return {
        preview: null,
        previewState: 'error',
        previewError: error,
        alreadyMember: false,
        trip: null,
      }
    }
  }

  if (!uid) {
    return { preview, previewState, previewError, alreadyMember, trip }
  }

  try {
    const snapshot = await readTrip(database, tripId)
    if (!snapshot.exists()) {
      return { preview, previewState, previewError, alreadyMember, trip }
    }
    trip = snapshot.data()
    alreadyMember = isExistingTripParticipant(trip, uid)
    if (alreadyMember && previewState !== 'ready') {
      preview = buildTripInvitationPreview(trip, tripId)
      previewState = 'ready'
    }
  } catch (error) {
    logError({
      operation: 'get',
      path: `trips/${tripId}`,
      code: error?.code,
    })
    if (error?.code !== 'permission-denied') {
      return {
        preview,
        previewState: previewState === 'ready' ? 'ready' : 'error',
        previewError: previewState === 'ready' ? previewError : error,
        alreadyMember: false,
        trip: null,
      }
    }
  }

  return { preview, previewState, previewError, alreadyMember, trip }
}
