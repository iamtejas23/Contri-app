import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { countUnreadNotifications, expenseNotificationId } from '../src/lib/notifications.js'
import { getTripIdFromInvite } from '../src/lib/invites.js'
import { addMemberToTrip } from '../src/lib/joinTrip.js'
import { computeBalances } from '../src/lib/balances.js'
import { createGuestSession } from '../src/lib/guestAuth.js'
import { buildCreateExpenseBatch } from '../src/services/expenseWrites.js'

const projectId = 'demo-contri-notifications'
let environment

const actor = { uid: 'member-a', name: 'A Traveler', email: 'a@example.test' }
const tripId = 'trip-alpha'
const trip = {
  name: 'Coast weekend',
  currency: 'INR',
  memberIds: ['member-a', 'member-b', 'member-c'],
  members: [
    { uid: 'member-a', name: 'A Traveler', email: 'a@example.test', role: 'admin', upiId: '' },
    { uid: 'member-b', name: 'B Traveler', email: 'b@example.test', role: 'member', upiId: '' },
    { uid: 'member-c', name: 'C Traveler', email: 'c@example.test', role: 'member', upiId: '' },
  ],
  adminIds: ['member-a'],
  createdBy: 'member-a',
}
const expenseValues = {
  title: 'Lunch',
  amount: '1250.50',
  category: 'Food',
  paidBy: 'member-a',
  date: '2026-06-02',
  note: '',
  splitMode: 'equal',
  splitAmong: [{ uid: 'member-a', value: 1 }, { uid: 'member-b', value: 1 }],
  receiptURL: '',
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

const createExpenseAsActor = async (extraWrite, memberIds = trip.memberIds) => {
  const database = environment.authenticatedContext(actor.uid, {
    name: actor.name,
    email: actor.email,
  }).firestore()
  const pending = buildCreateExpenseBatch({
    database,
    tripId,
    tripName: trip.name,
    memberIds,
    currency: trip.currency,
    values: expenseValues,
    actor,
  })
  extraWrite?.(pending, database)
  await assertSucceeds(pending.batch.commit())
  return { ...pending, database }
}

test('expense workflow atomically notifies the creator and each other trip member once', async () => {
  const { database, expenseId, activityId } = await createExpenseAsActor(undefined, [
    ...trip.memberIds,
    actor.uid,
    'member-b',
  ])

  const expense = await getDoc(doc(database, 'trips', tripId, 'expenses', expenseId))
  const activity = await getDoc(doc(database, 'trips', tripId, 'activity', activityId))
  assert.equal(expense.data().createdBy, actor.uid)
  assert.equal(expense.data().amount, 1250.5)
  assert.equal(activity.data().actorUid, actor.uid)

  const actorNotifications = await getDocs(collection(database, 'users', actor.uid, 'notifications'))
  assert.equal(actorNotifications.size, 1)
  const ownNotification = actorNotifications.docs[0]
  assert.equal(ownNotification.id, expenseNotificationId(tripId, expenseId))
  assert.equal(ownNotification.data().recipientUid, actor.uid)
  assert.equal(ownNotification.data().actorUid, actor.uid)
  assert.equal(ownNotification.data().expenseTitle, expenseValues.title)
  assert.equal(ownNotification.data().amount, 1250.5)
  assert.equal(ownNotification.data().tripName, trip.name)
  assert.equal(ownNotification.data().read, false)

  for (const recipientUid of ['member-b', 'member-c']) {
    const recipientDb = environment.authenticatedContext(recipientUid).firestore()
    const notificationId = expenseNotificationId(tripId, expenseId)
    const notification = await getDoc(doc(recipientDb, 'users', recipientUid, 'notifications', notificationId))
    assert.equal(notification.exists(), true)
    assert.equal(notification.data().tripName, trip.name)
    assert.equal(notification.data().actorUid, actor.uid)
    assert.equal(notification.data().amount, 1250.5)
    assert.equal(notification.data().read, false)
  }
})

test('users can only read their own notifications and can only mark them read', async () => {
  const { expenseId } = await createExpenseAsActor()
  const notificationId = expenseNotificationId(tripId, expenseId)
  const recipientDb = environment.authenticatedContext('member-b').firestore()
  const anotherMemberDb = environment.authenticatedContext('member-c').firestore()
  const ownRef = doc(recipientDb, 'users', 'member-b', 'notifications', notificationId)
  const otherRef = doc(anotherMemberDb, 'users', 'member-b', 'notifications', notificationId)

  await assertSucceeds(getDoc(ownRef))
  await assertFails(getDoc(otherRef))
  await assertSucceeds(updateDoc(ownRef, { read: true }))
  await assertFails(updateDoc(ownRef, { expenseTitle: 'Changed by recipient' }))
})

test('notification creation rejects mismatched expense details', async () => {
  const database = environment.authenticatedContext(actor.uid).firestore()
  const pending = buildCreateExpenseBatch({
    database,
    tripId,
    tripName: trip.name,
    memberIds: trip.memberIds,
    currency: trip.currency,
    values: expenseValues,
    actor,
  })
  await assertSucceeds(pending.batch.commit())

  const spoofed = buildCreateExpenseBatch({
    database,
    tripId,
    tripName: trip.name,
    memberIds: trip.memberIds.filter((uid) => uid !== actor.uid),
    currency: trip.currency,
    values: expenseValues,
    actor,
  })
  const forgedRef = doc(
    database,
    'users',
    'member-b',
    'notifications',
    expenseNotificationId(tripId, spoofed.expenseId),
  )
  spoofed.batch.set(forgedRef, {
    type: 'expense_created',
    tripId,
    tripName: trip.name,
    expenseId: spoofed.expenseId,
    recipientUid: 'member-b',
    actorUid: actor.uid,
    actorName: actor.name,
    expenseTitle: expenseValues.title,
    amount: 1,
    currency: trip.currency,
    read: false,
    createdAt: serverTimestamp(),
  })
  await assertFails(spoofed.batch.commit())
})

test('deterministic notification IDs prevent a second notification for one expense', async () => {
  const { expenseId } = await createExpenseAsActor()
  const duplicateDb = environment.authenticatedContext('member-a').firestore()
  for (const recipientUid of ['member-a', 'member-b']) {
    const duplicateRef = doc(
      duplicateDb,
      'users',
      recipientUid,
      'notifications',
      expenseNotificationId(tripId, expenseId),
    )

    await assertFails(setDoc(duplicateRef, {
      type: 'expense_created',
      tripId,
      tripName: trip.name,
      expenseId,
      recipientUid,
      actorUid: actor.uid,
      actorName: actor.name,
      expenseTitle: expenseValues.title,
      amount: 1250.5,
      currency: trip.currency,
      read: false,
      createdAt: serverTimestamp(),
    }))
  }
})

test('unread count counts only unread notifications', () => {
  assert.equal(countUnreadNotifications([
    { read: false },
    { read: true },
    { read: false },
    {},
  ]), 2)
  assert.equal(countUnreadNotifications([]), 0)
})

test('a valid trip code or invite URL resolves to the existing trip ID', () => {
  assert.equal(getTripIdFromInvite(tripId), tripId)
  assert.equal(getTripIdFromInvite(`https://contri-app.vercel.app/join?tripId=${tripId}`), tripId)
  assert.equal(getTripIdFromInvite('/join?tripId=trip-beta'), 'trip-beta')
  assert.equal(getTripIdFromInvite('https://contri-app.vercel.app/join'), '')
  assert.equal(getTripIdFromInvite(''), '')
})

test('guest creation uses Firebase Anonymous Auth and saves the provided profile', async () => {
  const app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    appId: `demo-${Date.now()}`,
  }, `guest-auth-${Date.now()}-${Math.random()}`)
  const auth = getAuth(app)
  const database = getFirestore(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(database, '127.0.0.1', 8080)

  try {
    const first = await createGuestSession({
      auth,
      database,
      name: 'Guest Traveler',
      contactEmail: 'guest@example.test',
    })
    assert.equal(first.isAnonymous, true)
    assert.equal(first.displayName, 'Guest Traveler')

    const profile = await getDoc(doc(database, 'users', first.uid))
    assert.equal(profile.data().name, 'Guest Traveler')
    assert.equal(profile.data().contactEmail, 'guest@example.test')
    assert.equal(profile.data().isGuest, true)

    const second = await createGuestSession({
      auth,
      database,
      name: 'Guest Traveler',
      contactEmail: 'guest@example.test',
    })
    assert.equal(second.uid, first.uid)
  } finally {
    await deleteApp(app)
  }
})

test('a guest can join an existing trip, add expenses, and see their balance', async () => {
  const joiningMember = {
    uid: 'member-d',
    name: 'D Traveler',
    email: 'd@example.test',
    isAnonymous: true,
  }
  const database = environment.authenticatedContext(joiningMember.uid, {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore()

  await assertSucceeds(addMemberToTrip({ database, tripId, member: joiningMember }))
  await assertSucceeds(addMemberToTrip({ database, tripId, member: joiningMember }))

  const joinedTrip = await getDoc(doc(database, 'trips', tripId))
  assert.equal(joinedTrip.data().memberIds.filter((uid) => uid === joiningMember.uid).length, 1)
  assert.equal(joinedTrip.data().members.filter((member) => member.uid === joiningMember.uid).length, 1)
  assert.equal(joinedTrip.data().members.find((member) => member.uid === joiningMember.uid).role, 'member')
  assert.equal(joinedTrip.data().members.find((member) => member.uid === joiningMember.uid).isGuest, true)

  const guestExpenseValues = {
    ...expenseValues,
    title: 'Guest coffee',
    amount: '100',
    paidBy: joiningMember.uid,
    splitAmong: [{ uid: joiningMember.uid, value: 1 }, { uid: 'member-a', value: 1 }],
  }
  const expenseBatch = buildCreateExpenseBatch({
    database,
    tripId,
    tripName: trip.name,
    memberIds: joinedTrip.data().memberIds,
    currency: trip.currency,
    values: guestExpenseValues,
    actor: joiningMember,
  })
  await assertSucceeds(expenseBatch.batch.commit())
  const storedExpense = await getDoc(doc(database, 'trips', tripId, 'expenses', expenseBatch.expenseId))
  assert.equal(storedExpense.exists(), true)
  await assertFails(updateDoc(
    doc(database, 'trips', tripId, 'expenses', expenseBatch.expenseId),
    { amount: 1000 },
  ))
  await assertFails(updateDoc(doc(database, 'trips', tripId), {
    adminIds: arrayUnion(joiningMember.uid),
  }))

  const outsiderDb = environment.authenticatedContext('member-outside').firestore()
  await assertFails(getDoc(doc(outsiderDb, 'trips', tripId, 'expenses', expenseBatch.expenseId)))

  const balances = computeBalances({
    trip: joinedTrip.data(),
    expenses: [{ id: expenseBatch.expenseId, ...storedExpense.data() }],
  })
  assert.equal(balances.find((entry) => entry.uid === joiningMember.uid).net, 50)
  assert.equal(balances.find((entry) => entry.uid === 'member-a').net, -50)
})

test('unauthenticated clients cannot add themselves to a trip', async () => {
  const database = environment.unauthenticatedContext().firestore()
  const joiningMember = { uid: 'member-d', name: 'D Traveler', email: '' }

  await assertFails(addMemberToTrip({ database, tripId, member: joiningMember }))
  let tripDoc
  await environment.withSecurityRulesDisabled(async (context) => {
    tripDoc = await getDoc(doc(context.firestore(), 'trips', tripId))
  })
  assert.equal(tripDoc.data().memberIds.includes(joiningMember.uid), false)
})

test('a normal authenticated invitee can still join without a guest label', async () => {
  const joiningMember = { uid: 'member-e', name: 'E Traveler', email: 'e@example.test' }
  const database = environment.authenticatedContext(joiningMember.uid, {
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()

  await assertSucceeds(addMemberToTrip({ database, tripId, member: joiningMember }))
  const joinedTrip = await getDoc(doc(database, 'trips', tripId))
  assert.equal(joinedTrip.data().memberIds.includes(joiningMember.uid), true)
  assert.equal(joinedTrip.data().members.find((member) => member.uid === joiningMember.uid).isGuest, undefined)
})

test('joining an unknown trip code fails without creating a trip', async () => {
  const joiningMember = { uid: 'member-d', name: 'D Traveler', email: 'd@example.test' }
  const database = environment.authenticatedContext(joiningMember.uid).firestore()

  await assertFails(addMemberToTrip({ database, tripId: 'missing-trip', member: joiningMember }))
})
