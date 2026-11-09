import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'

import { loadUserTrips } from '../src/lib/userTrips.js'
import { createTripDocument } from '../src/services/tripDocuments.js'

const projectId = 'demo-contri-notifications'
let environment

const androidActor = {
  uid: 'android-web-same-uid',
  name: 'Same Traveler',
  email: 'same@example.test',
}

const tripValues = {
  name: 'Android created coast',
  description: 'Created from the Android app',
  emoji: '🏝️',
  startDate: '2026-06-02',
  endDate: '2026-06-04',
  currency: 'INR',
  budget: null,
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
})

test('a trip created on Android appears in the web Trips list for the same Firebase UID', async () => {
  const androidDb = environment.authenticatedContext(androidActor.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const tripId = await assertSucceeds(createTripDocument({
    database: androidDb,
    values: tripValues,
    actor: androidActor,
  }))

  const webDb = environment.authenticatedContext(androidActor.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const listed = await assertSucceeds(loadUserTrips(webDb, androidActor.uid))
  const found = listed.find((trip) => trip.id === tripId)

  assert.ok(found, 'Web trip discovery must include the Android-created trip for the same UID')
  assert.equal(found.name, tripValues.name)
  assert.equal(found.createdBy, androidActor.uid)
  assert.deepEqual(found.memberIds, [androidActor.uid])
  assert.equal(found.members[0].uid, androidActor.uid)
  assert.equal(found.members[0].role, 'admin')

  const membershipHits = await assertSucceeds(getDocs(query(
    collection(webDb, 'trips'),
    where('memberIds', 'array-contains', androidActor.uid),
  )))
  const ownershipHits = await assertSucceeds(getDocs(query(
    collection(webDb, 'trips'),
    where('createdBy', '==', androidActor.uid),
  )))
  assert.ok(membershipHits.docs.some((item) => item.id === tripId))
  assert.ok(ownershipHits.docs.some((item) => item.id === tripId))
})

test('legacy owner trips without memberIds still appear in the web Trips list', async () => {
  const legacyTripId = 'legacy-android-owner'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', legacyTripId), {
      name: 'Older Android trip',
      currency: 'INR',
      createdBy: androidActor.uid,
      members: [{ uid: androidActor.uid, name: androidActor.name, role: 'admin' }],
    })
  })

  const webDb = environment.authenticatedContext(androidActor.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const listed = await assertSucceeds(loadUserTrips(webDb, androidActor.uid))
  assert.ok(listed.some((trip) => trip.id === legacyTripId))
})

test('a different Firebase UID cannot list another account’s Android-created trip', async () => {
  const androidDb = environment.authenticatedContext(androidActor.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const tripId = await assertSucceeds(createTripDocument({
    database: androidDb,
    values: tripValues,
    actor: androidActor,
  }))

  const otherDb = environment.authenticatedContext('other-web-user', {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
  const listed = await assertSucceeds(loadUserTrips(otherDb, 'other-web-user'))
  assert.equal(listed.some((trip) => trip.id === tripId), false)
  await assertFails(getDocs(query(
    collection(otherDb, 'trips'),
    where('memberIds', 'array-contains', androidActor.uid),
  )))
})
