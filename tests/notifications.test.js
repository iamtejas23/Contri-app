import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

import { countUnreadNotifications, expenseNotificationId } from '../src/lib/notifications.js'
import { createNotificationArrivalDetector } from '../src/lib/notificationSound.js'
import { getTripIdFromInvite } from '../src/lib/invites.js'
import { addMemberToTrip } from '../src/lib/joinTrip.js'
import { computeBalances } from '../src/lib/balances.js'
import { sortRecordsByDate } from '../src/lib/date.js'
import { createGuestSession } from '../src/lib/guestAuth.js'
import { buildCreateExpenseBatch } from '../src/services/expenseWrites.js'
import { buildCreateSettlementBatch } from '../src/services/settlementWrites.js'
import {
  clearAllNotificationsFromDatabase as clearAllNotifications,
  clearNotificationsForTripFromDatabase as clearNotificationsForTrip,
  getConfirmedNotificationClearAction,
  getNotificationTrips,
} from '../src/services/notificationClearing.js'
import { createTripDocument, deleteTripDocuments } from '../src/services/tripDocuments.js'

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
const tripValues = {
  name: 'New weekend',
  description: '',
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

test('an authenticated account can create its own trip but cannot create for another owner', async () => {
  const database = environment.authenticatedContext(actor.uid, {
    name: actor.name,
    email: actor.email,
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()

  const tripIdCreated = await assertSucceeds(createTripDocument({
    database,
    values: tripValues,
    actor,
  }))
  const createdTrip = await getDoc(doc(database, 'trips', tripIdCreated))
  assert.equal(createdTrip.data().createdBy, actor.uid)
  assert.deepEqual(createdTrip.data().memberIds, [actor.uid])
  assert.deepEqual(createdTrip.data().adminIds, [actor.uid])

  await assertFails(createTripDocument({
    database,
    values: tripValues,
    actor: { ...actor, uid: 'someone-else' },
  }))
})

test('trip admins can remove all trip subcollection documents and the parent trip', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await setDoc(doc(database, 'trips', tripId, 'expenses', 'expense-old'), {
      title: 'Old expense', amount: 10, createdBy: actor.uid,
    })
    await setDoc(doc(database, 'trips', tripId, 'settlements', 'settlement-old'), {
      from: 'member-a', to: 'member-b', amount: 10, createdBy: actor.uid,
    })
    await setDoc(doc(database, 'trips', tripId, 'activity', 'activity-old'), {
      actorUid: actor.uid, message: 'Old activity',
    })
  })

  const memberDb = environment.authenticatedContext('member-c').firestore()
  await assertFails(deleteTripDocuments({ database: memberDb, tripId }))
  const adminDb = environment.authenticatedContext(actor.uid).firestore()
  await assertSucceeds(deleteTripDocuments({ database: adminDb, tripId }))
  assert.equal((await getDoc(doc(adminDb, 'trips', tripId))).exists(), false)
})

test('legacy owner trips and child records without optional metadata remain readable and count toward balances', async () => {
  const legacyTripId = 'legacy-owner-trip'
  const legacyTrip = {
    name: 'Older coast weekend',
    currency: 'INR',
    createdBy: actor.uid,
    members: [
      { uid: actor.uid, name: actor.name, role: 'admin' },
      { uid: 'member-b', name: 'B Traveler', role: 'member' },
    ],
  }

  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await setDoc(doc(database, 'trips', legacyTripId), legacyTrip)
    await setDoc(doc(database, 'trips', legacyTripId, 'expenses', 'expense-without-metadata'), {
      title: 'Old dinner',
      amount: 120,
      paidBy: actor.uid,
      splitMode: 'equal',
      splitAmong: [{ uid: actor.uid, value: 1 }, { uid: 'member-b', value: 1 }],
    })
    await setDoc(doc(database, 'trips', legacyTripId, 'settlements', 'settlement-without-metadata'), {
      from: 'member-b',
      to: actor.uid,
      amount: 60,
      method: 'upi',
    })
  })

  const database = environment.authenticatedContext(actor.uid).firestore()
  const storedTrip = await assertSucceeds(getDoc(doc(database, 'trips', legacyTripId)))
  assert.equal(storedTrip.data().members[0].isGuest, undefined)
  const ownedTrips = await assertSucceeds(getDocs(query(
    collection(database, 'trips'),
    where('createdBy', '==', actor.uid),
  )))
  assert.ok(ownedTrips.docs.some((item) => item.id === legacyTripId))

  const expenses = await assertSucceeds(getDocs(collection(database, 'trips', legacyTripId, 'expenses')))
  const settlements = await assertSucceeds(getDocs(collection(database, 'trips', legacyTripId, 'settlements')))
  assert.equal(expenses.size, 1)
  assert.equal(settlements.size, 1)
  assert.deepEqual(sortRecordsByDate(expenses.docs.map((item) => ({ id: item.id, ...item.data() })), ['date', 'createdAt']).map((item) => item.id), ['expense-without-metadata'])

  const balances = computeBalances({
    trip: storedTrip.data(),
    expenses: expenses.docs.map((item) => ({ id: item.id, ...item.data() })),
    settlements: settlements.docs.map((item) => ({ id: item.id, ...item.data() })),
  })
  assert.equal(balances.find((item) => item.uid === actor.uid).net, 0)
  assert.equal(balances.find((item) => item.uid === 'member-b').net, 0)
})

test('legacy guest ownership remains scoped to the authenticated guest UID', async () => {
  const legacyTripId = 'legacy-guest-trip'
  const guestUid = 'guest-owner'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'trips', legacyTripId), {
      name: 'Guest legacy trip',
      currency: 'INR',
      createdBy: guestUid,
      members: [{ uid: guestUid, name: 'Guest owner', role: 'admin' }],
    })
  })

  const guestDb = environment.authenticatedContext(guestUid, {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore()
  await assertSucceeds(getDoc(doc(guestDb, 'trips', legacyTripId)))
  const outsiderDb = environment.authenticatedContext('unrelated-guest', {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore()
  await assertFails(getDoc(doc(outsiderDb, 'trips', legacyTripId)))
})

test('a joined member remains in trip queries after sign-out, sign-in, and fresh app sessions', async () => {
  const email = `membership-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const password = 'EmulatorOnly123!'
  const apps = []
  let sessionNumber = 0
  const createSession = () => {
    const app = initializeApp({
      apiKey: 'demo-api-key',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: `demo-${Date.now()}`,
    }, `membership-session-${Date.now()}-${sessionNumber++}`)
    apps.push(app)
    const auth = getAuth(app)
    const database = getFirestore(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(database, '127.0.0.1', 8080)
    return { app, auth, database }
  }

  try {
    const firstSession = createSession()
    const account = await createUserWithEmailAndPassword(firstSession.auth, email, password)
    const uid = account.user.uid
    const joinedMember = { uid, name: 'Persistent Traveler', email }

    await addMemberToTrip({ database: firstSession.database, tripId, member: joinedMember })
    await addMemberToTrip({ database: firstSession.database, tripId, member: joinedMember })
    assert.equal(firstSession.auth.currentUser.uid, uid)
    const joinedTrip = await getDoc(doc(firstSession.database, 'trips', tripId))
    assert.equal(joinedTrip.data().memberIds.includes(uid), true)

    const assertTripInList = async (database) => {
      const results = await assertSucceeds(getDocs(query(
        collection(database, 'trips'),
        where('memberIds', 'array-contains', uid),
      )))
      assert.ok(results.docs.some((item) => item.id === tripId))
      const storedTrip = await getDoc(doc(database, 'trips', tripId))
      assert.equal(storedTrip.data().memberIds.filter((id) => id === uid).length, 1)
      assert.equal(storedTrip.data().members.filter((item) => item.uid === uid).length, 1)
    }

    await assertTripInList(firstSession.database)
    await signOut(firstSession.auth)
    await signInWithEmailAndPassword(firstSession.auth, email, password)
    assert.equal(firstSession.auth.currentUser.uid, uid)
    await assertTripInList(firstSession.database)

    await deleteApp(firstSession.app)
    const secondSession = createSession()
    const restored = await signInWithEmailAndPassword(secondSession.auth, email, password)
    assert.equal(restored.user.uid, uid)
    await assertTripInList(secondSession.database)

    await addMemberToTrip({ database: secondSession.database, tripId, member: joinedMember })
    await assertTripInList(secondSession.database)

    const outsiderDb = environment.authenticatedContext('membership-outsider').firestore()
    await assertFails(getDoc(doc(outsiderDb, 'trips', tripId)))
  } finally {
    await Promise.all(apps.map((app) => deleteApp(app).catch(() => {})))
  }
})

test('trip metadata and member role updates are limited to admins and preserve membership ownership', async () => {
  const adminDb = environment.authenticatedContext(actor.uid).firestore()
  const memberDb = environment.authenticatedContext('member-c').firestore()

  await assertSucceeds(updateDoc(doc(adminDb, 'trips', tripId), {
    name: 'Updated coast weekend',
    updatedAt: serverTimestamp(),
  }))
  await assertFails(updateDoc(doc(memberDb, 'trips', tripId), {
    name: 'Unauthorized rename',
    updatedAt: serverTimestamp(),
  }))
  await assertFails(updateDoc(doc(adminDb, 'trips', tripId), {
    createdBy: 'member-b',
    updatedAt: serverTimestamp(),
  }))

  const nextMembers = trip.members.map((member) =>
    member.uid === 'member-b' ? { ...member, role: 'admin' } : member,
  )
  await assertSucceeds(updateDoc(doc(adminDb, 'trips', tripId), {
    members: nextMembers,
    adminIds: ['member-a', 'member-b'],
    updatedAt: serverTimestamp(),
  }))
  const escalatedMembers = nextMembers.map((member) =>
    member.uid === 'member-c' ? { ...member, role: 'admin' } : member,
  )
  await assertFails(updateDoc(doc(memberDb, 'trips', tripId), {
    members: escalatedMembers,
    adminIds: ['member-a', 'member-b', 'member-c'],
    updatedAt: serverTimestamp(),
  }))
})

test('only an admin can add an existing authenticated member to a trip', async () => {
  const invitedMember = {
    uid: 'member-new',
    name: 'New Traveler',
    email: 'new@example.test',
    role: 'member',
    upiId: '',
  }
  const adminDb = environment.authenticatedContext(actor.uid).firestore()
  await assertSucceeds(updateDoc(doc(adminDb, 'trips', tripId), {
    members: arrayUnion(invitedMember),
    memberIds: arrayUnion(invitedMember.uid),
    updatedAt: serverTimestamp(),
  }))

  const memberDb = environment.authenticatedContext('member-b').firestore()
  const forgedInvite = { ...invitedMember, uid: 'member-forged' }
  await assertFails(updateDoc(doc(memberDb, 'trips', tripId), {
    members: arrayUnion(forgedInvite),
    memberIds: arrayUnion(forgedInvite.uid),
    updatedAt: serverTimestamp(),
  }))
})

test('a trip member cannot create an expense attributed to another account', async () => {
  const database = environment.authenticatedContext('member-b').firestore()
  await assertFails(setDoc(doc(database, 'trips', tripId, 'expenses', 'forged-expense'), {
    title: 'Forged',
    amount: 25,
    category: 'Food',
    paidBy: 'member-b',
    createdBy: 'member-a',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
})

test('a trip member can update only their own embedded profile details', async () => {
  const memberDb = environment.authenticatedContext('member-b').firestore()
  const nextMembers = trip.members.map((member) =>
    member.uid === 'member-b' ? { ...member, name: 'Updated B', upiId: 'b@upi' } : member,
  )

  await assertSucceeds(updateDoc(doc(memberDb, 'trips', tripId), {
    members: nextMembers,
    updatedAt: serverTimestamp(),
  }))

  const forgedMembers = nextMembers.map((member) =>
    member.uid === 'member-a' ? { ...member, name: 'Forged admin name' } : member,
  )
  await assertFails(updateDoc(doc(memberDb, 'trips', tripId), {
    members: forgedMembers,
    updatedAt: serverTimestamp(),
  }))
})

test('settlement creation is admin-only and ties the settlement to the authenticated actor', async () => {
  const values = {
    from: 'member-b',
    to: 'member-a',
    amount: '200',
    method: 'upi',
    settledAt: '2026-06-03',
    note: 'UPI payment',
  }
  const adminDb = environment.authenticatedContext(actor.uid).firestore()
  const adminBatch = buildCreateSettlementBatch({
    database: adminDb, tripId, values, actor,
  })
  await assertSucceeds(adminBatch.batch.commit())
  const settlement = await getDoc(doc(adminDb, 'trips', tripId, 'settlements', adminBatch.settlementId))
  assert.equal(settlement.data().createdBy, actor.uid)
  assert.equal(settlement.data().amount, 200)

  const memberDb = environment.authenticatedContext('member-b').firestore()
  const memberBatch = buildCreateSettlementBatch({
    database: memberDb,
    tripId,
    values,
    actor: { ...actor, uid: 'member-b' },
  })
  await assertFails(memberBatch.batch.commit())
})

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

test('clear all removes only the signed-in user notification documents', async () => {
  const uid = 'clear-owner'
  const database = environment.authenticatedContext(uid).firestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore()
    await Promise.all([
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'first'), { tripId, read: false }),
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'second'), { tripId, read: true }),
      setDoc(doc(adminDb, 'users', 'another-user', 'notifications', 'untouched'), { tripId, read: false }),
    ])
  })

  const result = await assertSucceeds(clearAllNotifications({ uid, database }))
  assert.equal(result.deletedCount, 2)
  assert.equal(result.deletedUnreadCount, 1)
  assert.equal((await getDocs(collection(database, 'users', uid, 'notifications'))).size, 0)
  let otherUserNotifications
  await environment.withSecurityRulesDisabled(async (context) => {
    otherUserNotifications = await getDocs(collection(context.firestore(), 'users', 'another-user', 'notifications'))
  })
  assert.equal(otherUserNotifications.size, 1)
  await assertFails(deleteDoc(doc(database, 'users', 'another-user', 'notifications', 'untouched')))
})

test('clear by trip removes only exact matching trip IDs and keeps legacy notifications', async () => {
  const uid = 'trip-clear-owner'
  const database = environment.authenticatedContext(uid).firestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore()
    await Promise.all([
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'target-1'), { tripId: 'trip-target', tripName: 'Target trip', read: false }),
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'target-2'), { tripId: 'trip-target', tripName: 'Target trip', read: true }),
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'other-trip'), { tripId: 'trip-other', tripName: 'Other trip', read: false }),
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'legacy'), { tripName: 'Legacy without ID', read: false }),
      setDoc(doc(adminDb, 'users', uid, 'notifications', 'invalid-trip-id'), { tripId: 42, tripName: 'Malformed', read: false }),
      setDoc(doc(adminDb, 'users', 'another-user', 'notifications', 'same-trip'), { tripId: 'trip-target', read: false }),
    ])
  })

  const trips = await assertSucceeds(getNotificationTrips({ uid, database }))
  assert.deepEqual(trips, [
    { tripId: 'trip-other', tripName: 'Other trip', count: 1 },
    { tripId: 'trip-target', tripName: 'Target trip', count: 2 },
  ])
  const result = await assertSucceeds(clearNotificationsForTrip({ uid, tripId: 'trip-target', database }))
  assert.equal(result.deletedCount, 2)
  assert.equal(result.deletedUnreadCount, 1)
  const remaining = await getDocs(collection(database, 'users', uid, 'notifications'))
  assert.deepEqual(remaining.docs.map((notification) => notification.id).sort(), [
    'invalid-trip-id', 'legacy', 'other-trip',
  ])
  let anotherUser
  await environment.withSecurityRulesDisabled(async (context) => {
    anotherUser = await getDocs(collection(context.firestore(), 'users', 'another-user', 'notifications'))
  })
  assert.equal(anotherUser.size, 1)
})

test('cancelling a clear confirmation leaves no executable deletion action', () => {
  let deletionCalls = 0
  const cancelledDialog = null
  const action = getConfirmedNotificationClearAction(cancelledDialog)
  if (action) deletionCalls += 1
  assert.equal(deletionCalls, 0)
  assert.deepEqual(getConfirmedNotificationClearAction({ kind: 'trip-picker' }), null)
  assert.deepEqual(getConfirmedNotificationClearAction({ kind: 'trip-confirm', trip: { tripId: 'trip-alpha' } }), {
    type: 'trip',
    tripId: 'trip-alpha',
  })
})

test('notification clearing splits large delete sets below Firestore batch limits', async () => {
  const uid = 'large-clear-owner'
  const database = environment.authenticatedContext(uid).firestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore()
    for (let index = 0; index < 1001; index += 100) {
      const writes = Array.from({ length: Math.min(100, 1001 - index) }, (_, offset) => {
        const notificationIndex = index + offset
        return setDoc(doc(adminDb, 'users', uid, 'notifications', `notice-${notificationIndex}`), {
          tripId,
          read: notificationIndex % 2 === 0,
        })
      })
      await Promise.all(writes)
    }
  })

  const result = await assertSucceeds(clearAllNotifications({ uid, database }))
  assert.equal(result.deletedCount, 1001)
  assert.equal((await getDocs(collection(database, 'users', uid, 'notifications'))).size, 0)
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

test('Firestore notification listener ignores history and plays once for a live notification', async () => {
  const app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId,
  }, `sound-listener-${Date.now()}`)
  const database = getFirestore(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const credential = await createUserWithEmailAndPassword(
    auth,
    `sound-${Date.now()}@example.test`,
    'password123',
  )
  const uid = credential.user.uid
  connectFirestoreEmulator(database, '127.0.0.1', 8080)
  const played = []
  let resolvePlayed
  const playedOnce = new Promise((resolve) => { resolvePlayed = resolve })
  let stopListening = () => {}
  let playbackTimeout
  const detect = createNotificationArrivalDetector(uid, {
    play: () => {
      played.push('sound')
      resolvePlayed()
    },
    seenKeys: new Set(),
  })

  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', uid, 'notifications', 'history'), {
        recipientUid: uid,
        actorUid: 'another-user',
        read: false,
        createdAt: serverTimestamp(),
      })
    })
    const snapshotQuery = query(
      collection(database, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(40),
    )
    stopListening = onSnapshot(snapshotQuery, { includeMetadataChanges: true }, detect)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Notification listener did not establish a server snapshot')), 4000)
      const stopBaseline = onSnapshot(snapshotQuery, { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache) {
          clearTimeout(timeout)
          stopBaseline()
          resolve()
        }
      }, reject)
    })
    assert.deepEqual(played, [])

    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', uid, 'notifications', 'live'), {
        recipientUid: uid,
        actorUid: 'another-user',
        read: false,
        createdAt: serverTimestamp(),
      })
    })
    await Promise.race([
      playedOnce,
      new Promise((_, reject) => {
        playbackTimeout = setTimeout(() => reject(new Error('Live notification did not trigger sound')), 4000)
      }),
    ])
    clearTimeout(playbackTimeout)
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(played, ['sound'])
  } finally {
    stopListening()
    clearTimeout(playbackTimeout)
    await deleteApp(app)
  }
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
  const guestTrips = await assertSucceeds(getDocs(query(
    collection(database, 'trips'),
    where('memberIds', 'array-contains', joiningMember.uid),
  )))
  assert.ok(guestTrips.docs.some((item) => item.id === tripId))
  const restoredGuestDatabase = environment.authenticatedContext(joiningMember.uid, {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore()
  const restoredGuestTrips = await assertSucceeds(getDocs(query(
    collection(restoredGuestDatabase, 'trips'),
    where('memberIds', 'array-contains', joiningMember.uid),
  )))
  assert.ok(restoredGuestTrips.docs.some((item) => item.id === tripId))

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

  await assert.rejects(
    addMemberToTrip({ database, tripId: 'missing-trip', member: joiningMember }),
    /could not be found/i,
  )
})
