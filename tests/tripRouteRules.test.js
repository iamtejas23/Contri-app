import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

let environment

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-contri-trip-route-rules',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})

after(async () => environment?.cleanup())

const tripData = () => ({
  createdBy: 'route-admin',
  memberIds: ['route-admin', 'route-member', 'removed-member'],
  adminIds: ['route-admin'],
})

const routeData = (tripId, uid) => ({
  tripId,
  version: 1,
  start: { name: 'Pune', description: '', plannedArrivalDate: '', actualCompletionDate: '', status: 'upcoming' },
  stops: [],
  destination: { name: 'Mumbai', description: '', plannedArrivalDate: '', actualCompletionDate: '', status: 'upcoming' },
  updatedBy: uid,
  updatedAt: serverTimestamp(),
})

test('current trip members can read routes, but only trip admins can create or edit them', async () => {
  const tripId = 'route-rules-read-write'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', tripId), tripData())
  })

  const adminDb = environment.authenticatedContext('route-admin').firestore()
  const memberDb = environment.authenticatedContext('route-member').firestore()
  const outsiderDb = environment.authenticatedContext('route-outsider').firestore()
  const routeRef = doc(adminDb, 'trips', tripId, 'route', 'current')

  await assertSucceeds(setDoc(routeRef, routeData(tripId, 'route-admin')))
  await assertSucceeds(getDoc(doc(memberDb, 'trips', tripId, 'route', 'current')))
  await assertFails(getDoc(doc(outsiderDb, 'trips', tripId, 'route', 'current')))
  await assertFails(setDoc(doc(memberDb, 'trips', tripId, 'route', 'current'), routeData(tripId, 'route-member')))
  await assertFails(updateDoc(doc(memberDb, 'trips', tripId, 'route', 'current'), {
    updatedBy: 'route-member', updatedAt: serverTimestamp(),
  }))
  await assertFails(deleteDoc(routeRef))
})

test('removing a member immediately removes route read access; malformed writes fail', async () => {
  const tripId = 'route-rules-membership-change'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', tripId), tripData())
  })

  const adminDb = environment.authenticatedContext('route-admin').firestore()
  const removedMemberDb = environment.authenticatedContext('removed-member').firestore()
  const routeRef = doc(adminDb, 'trips', tripId, 'route', 'current')
  await assertSucceeds(setDoc(routeRef, routeData(tripId, 'route-admin')))
  await assertSucceeds(getDoc(doc(removedMemberDb, 'trips', tripId, 'route', 'current')))

  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'trips', tripId), { memberIds: ['route-admin', 'route-member'] })
  })
  await assertFails(getDoc(doc(removedMemberDb, 'trips', tripId, 'route', 'current')))

  const malformed = { ...routeData(tripId, 'route-admin'), extraPrivateField: 'unexpected' }
  await assertFails(setDoc(doc(adminDb, 'trips', tripId, 'route', 'bad'), malformed))
  await assertFails(setDoc(doc(adminDb, 'trips', tripId, 'route', 'current'), {
    ...routeData(tripId, 'route-admin'), start: { name: '', description: '', plannedArrivalDate: '', actualCompletionDate: '', status: 'upcoming' },
  }))
})

test('members can read saved canvas positions while only trip admins can update them', async () => {
  const tripId = 'route-canvas-permissions'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', tripId), tripData())
  })
  const adminDb = environment.authenticatedContext('route-admin').firestore()
  const memberDb = environment.authenticatedContext('route-member').firestore()
  const routeRef = doc(adminDb, 'trips', tripId, 'route', 'current')
  const canvasRoute = routeData(tripId, 'route-admin')
  canvasRoute.start.canvasPosition = { x: 0, y: 50 }
  canvasRoute.destination.canvasPosition = { x: 100, y: 50 }
  canvasRoute.stops = [{ id: 'stop-a', name: 'Lonavala', description: '', plannedArrivalDate: '', actualCompletionDate: '', status: 'upcoming', canvasPosition: { x: 50, y: 30 } }]
  await assertSucceeds(setDoc(routeRef, canvasRoute))
  await assertSucceeds(getDoc(doc(memberDb, 'trips', tripId, 'route', 'current')))
  await assertFails(updateDoc(doc(memberDb, 'trips', tripId, 'route', 'current'), {
    updatedBy: 'route-member', updatedAt: serverTimestamp(),
  }))

  const invalidPosition = { ...canvasRoute, start: { ...canvasRoute.start, canvasPosition: { x: 1000, y: 50 } } }
  await assertFails(setDoc(routeRef, invalidPosition))
})
