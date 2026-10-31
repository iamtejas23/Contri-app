import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'

const PREVIEW_ID = 'current'

export const buildTripInvitationPreview = (trip, tripId) => ({
  tripId,
  tripName: String(trip?.name || 'Contri trip').slice(0, 120),
  description: String(trip?.description || '').slice(0, 280),
  emoji: String(trip?.emoji || '🧳').slice(0, 16),
  startDate: String(trip?.startDate || '').slice(0, 32),
  endDate: String(trip?.endDate || '').slice(0, 32),
  memberCount: Array.isArray(trip?.memberIds)
    ? trip.memberIds.length
    : Array.isArray(trip?.members) ? trip.members.length : 1,
})

export const getTripInvitationPreviewRef = (database, tripId) =>
  doc(database, 'trips', tripId, 'invitationPreview', PREVIEW_ID)

export const publishTripInvitationPreview = async ({ database, trip, tripId }) => {
  const preview = buildTripInvitationPreview(trip, tripId)
  await setDoc(getTripInvitationPreviewRef(database, tripId), {
    ...preview,
    updatedAt: serverTimestamp(),
  })
  return preview
}

export const loadTripInvitationPreview = async ({ database, tripId }) => {
  const snapshot = await getDoc(getTripInvitationPreviewRef(database, tripId))
  return snapshot.exists() ? snapshot.data() : null
}

export const isValidTripInvitationPreview = (preview, tripId) => Boolean(
  preview
  && preview.tripId === tripId
  && typeof preview.tripName === 'string'
  && typeof preview.memberCount === 'number'
  && Number.isInteger(preview.memberCount)
  && preview.memberCount > 0,
)
