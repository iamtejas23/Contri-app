import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import { logFirestoreOperationError } from '../src/lib/firestoreDiagnostics.js'
import { resolveJoinInvitation } from '../src/lib/joinInvitation.js'
import { addMemberToTrip } from '../src/lib/joinTrip.js'
import { publishTripInvitationPreview } from '../src/services/tripInvitationPreview.js'

const projectId = 'demo-contri-notifications'
let environment

const tripId = 'join-invite-trip'
const creator = { uid: 'member-a', name: 'A Traveler', email: 'a@example.test' }
const existingMember = { uid: 'member-b', name: 'B Traveler', email: 'b@example.test' }
const invitee = { uid: 'member-z', name: 'Z Traveler', email: 'z@example.test' }

const trip = {
  name: 'Coast weekend',
  description: 'Goa',
  emoji: '🏝️',
  startDate: '2026-06-02',
  endDate: '2026-06-04',
  currency: 'INR',
  memberIds: [creator.uid, existingMember.uid],
  members: [
    { uid: creator.uid, name: creator.name, email: creator.email, role: 'admin', upiId: '' },
    { uid: existingMember.uid, name: existingMember.name, email: existingMember.email, role: 'member', upiId: '' },
  ],
  adminIds: [creator.uid],
  createdBy: creator.uid,
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})

after(async () => {
  await environment?.cleanup()
})

beforeEach(async () => {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', tripId), trip)
  })
})

const diagnostics = () => {
  const entries = []
  return {
    entries,
    logError: (details) => entries.push(details),
  }
}

test('firestore diagnostics log the operation and code without extra fields', () => {
  const lines = []
  logFirestoreOperationError(
    {
      operation: 'get',
      path: 'trips/join-invite-trip/invitationPreview/current',
      code: 'permission-denied',
      token: 'secret',
      authorization: 'Bearer abc',
    },
    { warn: (_label, payload) => lines.push(payload) },
  )
  assert.deepEqual(lines, [{
    operation: 'get',
    path: 'trips/join-invite-trip/invitationPreview/current',
    code: 'permission-denied',
  }])
})

test('trip creator opening an invite is already a member and does not join again', async () => {
  const database = environment.authenticatedContext(creator.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  await assertSucceeds(publishTripInvitationPreview({ database, trip, tripId }))
  const logs = diagnostics()

  const result = await resolveJoinInvitation({
    database,
    tripId,
    uid: creator.uid,
    logError: logs.logError,
  })
  assert.equal(result.alreadyMember, true)
  assert.equal(result.previewState, 'ready')
  assert.equal(result.preview.tripName, trip.name)
  assert.equal(logs.entries.length, 0)

  const before = (await getDoc(doc(database, 'trips', tripId))).data()
  await assertSucceeds(addMemberToTrip({
    database,
    tripId,
    member: { ...creator, isAnonymous: false },
  }))
  const after = (await getDoc(doc(database, 'trips', tripId))).data()
  assert.deepEqual(after.memberIds, before.memberIds)
  assert.equal(after.members.filter((member) => member.uid === creator.uid).length, 1)
  assert.equal(after.members.find((member) => member.uid === creator.uid).role, 'admin')
})

test('existing members opening an invite see membership without a join write', async () => {
  const database = environment.authenticatedContext(existingMember.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const adminDb = environment.authenticatedContext(creator.uid).firestore()
  await assertSucceeds(publishTripInvitationPreview({ database: adminDb, trip, tripId }))

  const result = await resolveJoinInvitation({ database, tripId, uid: existingMember.uid })
  assert.equal(result.alreadyMember, true)
  assert.equal(result.previewState, 'ready')

  const before = (await getDoc(doc(database, 'trips', tripId))).data()
  await assertSucceeds(addMemberToTrip({
    database,
    tripId,
    member: { ...existingMember, isAnonymous: false },
  }))
  const after = (await getDoc(doc(database, 'trips', tripId))).data()
  assert.deepEqual(after.memberIds, before.memberIds)
  assert.equal(after.members.filter((member) => member.uid === existingMember.uid).length, 1)
})

test('invited non-members can read a valid preview, cannot read the trip, and can join', async () => {
  const adminDb = environment.authenticatedContext(creator.uid).firestore()
  await assertSucceeds(publishTripInvitationPreview({ database: adminDb, trip, tripId }))
  const database = environment.authenticatedContext(invitee.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const logs = diagnostics()

  const result = await resolveJoinInvitation({
    database,
    tripId,
    uid: invitee.uid,
    logError: logs.logError,
  })
  assert.equal(result.alreadyMember, false)
  assert.equal(result.previewState, 'ready')
  assert.equal(result.preview.tripName, trip.name)
  assert.equal(result.trip, null)
  assert.equal(logs.entries.length, 1)
  assert.deepEqual(logs.entries[0], {
    operation: 'get',
    path: `trips/${tripId}`,
    code: 'permission-denied',
  })
  await assertFails(getDoc(doc(database, 'trips', tripId)))

  await assertSucceeds(addMemberToTrip({
    database,
    tripId,
    member: { ...invitee, isAnonymous: false },
  }))
  const joined = (await getDoc(doc(database, 'trips', tripId))).data()
  assert.equal(joined.memberIds.includes(invitee.uid), true)
  assert.equal(joined.members.some((member) => member.uid === invitee.uid && member.role === 'member'), true)
})

test('a denied invitation preview is not treated as lost trip access for the creator', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', tripId, 'invitationPreview', 'current'), {
      tripId,
      tripName: trip.name,
      description: '',
      emoji: '🧳',
      startDate: '',
      endDate: '',
      memberCount: 2,
      extraField: 'not-allowed',
      updatedAt: serverTimestamp(),
    })
  })
  const database = environment.authenticatedContext(creator.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  await assertFails(getDoc(doc(database, 'trips', tripId, 'invitationPreview', 'current')))
  const logs = diagnostics()

  const result = await resolveJoinInvitation({
    database,
    tripId,
    uid: creator.uid,
    logError: logs.logError,
  })
  assert.equal(result.alreadyMember, true)
  assert.equal(result.previewState, 'ready')
  assert.equal(result.preview.tripName, trip.name)
  assert.equal(result.previewError, '')
  assert.deepEqual(logs.entries, [{
    operation: 'get',
    path: `trips/${tripId}/invitationPreview/current`,
    code: 'permission-denied',
  }])
})

test('legacy creator-only trips skip join and still resolve as already a member', async () => {
  const legacyTripId = 'legacy-creator-trip'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', legacyTripId), {
      name: 'Legacy coast',
      currency: 'INR',
      createdBy: creator.uid,
      members: [{ uid: creator.uid, name: creator.name, role: 'admin' }],
    })
  })
  const database = environment.authenticatedContext(creator.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const result = await resolveJoinInvitation({ database, tripId: legacyTripId, uid: creator.uid })
  assert.equal(result.alreadyMember, true)
  assert.equal(result.previewState, 'ready')
  await assertSucceeds(addMemberToTrip({
    database,
    tripId: legacyTripId,
    member: { ...creator, isAnonymous: false },
  }))
  const after = (await getDoc(doc(database, 'trips', legacyTripId))).data()
  assert.equal(after.memberIds, undefined)
  assert.equal(after.members.length, 1)
})

test('unauthenticated clients remain denied from joining', async () => {
  const database = environment.unauthenticatedContext().firestore()
  const result = await resolveJoinInvitation({ database, tripId, uid: '' })
  assert.equal(result.alreadyMember, false)
  await assertFails(addMemberToTrip({
    database,
    tripId,
    member: { ...invitee, isAnonymous: false },
  }))
})
