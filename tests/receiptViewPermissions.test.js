import assert from 'node:assert/strict'
import test from 'node:test'

import { canUploadTripReceipts, canViewTripReceipts, getReceiptViewerIds } from '../src/lib/receiptPermissions.js'
import { getMemberGroupRoles, getReceiptViewStatus } from '../src/lib/tripGroupPresentation.js'

const trip = {
  createdBy: 'admin',
  memberIds: ['admin', 'member', 'guest', 'long-name'],
  adminIds: ['admin'],
  members: [
    { uid: 'admin', name: 'Ada Admin', role: 'admin' },
    { uid: 'member', name: 'Mia Member', role: 'member' },
    { uid: 'guest', name: 'Gus Guest', role: 'member', isGuest: true },
    { uid: 'long-name', name: 'Alexandrina Bartholomew-Worthington the Third of Very Long Names', role: 'member' },
  ],
}

const legacyExpense = {
  receiptURL: 'https://ik.imagekit.io/legacy/receipt.jpg',
  receiptFiles: {
    kept: { provider: 'supabase', fileId: 'kept', path: 'trips/t/expenses/e/kept.jpg' },
  },
}

test('receipt viewing defaults to denied and stays independent of upload permission', () => {
  assert.equal(canViewTripReceipts(trip, { uid: 'member' }), false)
  assert.equal(canViewTripReceipts({ ...trip, allowMemberReceiptUploads: true }, { uid: 'member' }), false)
  assert.equal(canViewTripReceipts({ ...trip, receiptViewerIds: ['member'] }, { uid: 'member' }), true)
  assert.equal(canUploadTripReceipts({ ...trip, receiptViewerIds: ['member'] }, {
    uid: 'member', email: 'member@example.test', emailVerified: true,
  }), false)
  assert.equal(canUploadTripReceipts({ ...trip, allowMemberReceiptUploads: true }, { uid: 'member' }), true)
  assert.equal(canViewTripReceipts(trip, { uid: 'admin', email: 'admin@example.test' }), true)
  assert.equal(canViewTripReceipts({ ...trip, receiptViewerIds: ['member'] }, { uid: 'outsider' }), false)
  assert.equal(canViewTripReceipts(trip, { uid: 'guest', isAnonymous: true }), false)
  assert.equal(canViewTripReceipts({ ...trip, receiptViewerIds: ['guest'] }, { uid: 'guest', isAnonymous: true }), true)
  assert.equal(canViewTripReceipts({ ...trip, memberIds: ['admin'], receiptViewerIds: ['guest'] }, { uid: 'guest', isAnonymous: true }), false)
  assert.equal(canUploadTripReceipts({ ...trip, allowMemberReceiptUploads: true, receiptViewerIds: ['guest'] }, {
    uid: 'guest', isAnonymous: true,
  }), false)
  assert.equal(canViewTripReceipts({ ...trip, memberIds: ['admin'], receiptViewerIds: ['member'] }, { uid: 'member' }), false)
  assert.deepEqual(getReceiptViewerIds({ ...trip, receiptViewerIds: ['member', 'removed', 'member'] }), ['member'])
})

test('legacy receipt metadata is not rewritten by the viewing permission helper', () => {
  const before = structuredClone(legacyExpense)
  canViewTripReceipts({ ...trip, receiptViewerIds: ['member'] }, { uid: 'member' })
  assert.equal(legacyExpense.receiptURL, 'https://ik.imagekit.io/legacy/receipt.jpg')
  assert.deepEqual(legacyExpense, before)
})

test('group roles distinguish the creator, admins, members and settlement managers', () => {
  const creator = getMemberGroupRoles(trip.members[0], trip, ['member'])
  const manager = getMemberGroupRoles(trip.members[1], trip, ['member'])
  const plain = getMemberGroupRoles(trip.members[3], trip, [])
  assert.deepEqual(creator.roles.map((role) => role.label), ['Trip creator'])
  assert.equal(creator.isCreator, true)
  assert.deepEqual(manager.roles.map((role) => role.label), ['Member', 'Settlement Manager'])
  assert.deepEqual(plain.roles.map((role) => role.label), ['Member'])
  assert.equal(plain.roles.every((role) => !role.label.includes('👑')), true)
})

test('receipt viewing status labels update for grant, revoke, admin and missing photos', () => {
  const missingPhoto = { uid: 'member', name: '', photoURL: '' }
  const granted = getReceiptViewStatus({ member: trip.members[1], trip, viewerIds: ['member'] })
  const revoked = getReceiptViewStatus({ member: missingPhoto, trip, viewerIds: [] })
  const admin = getReceiptViewStatus({ member: trip.members[0], trip, viewerIds: [] })
  assert.equal(granted.label, 'Receipt access enabled')
  assert.equal(granted.detail, 'Can view receipts')
  assert.equal(revoked.enabled, false)
  assert.equal(revoked.label, 'Receipt access disabled')
  assert.equal(admin.enabled, true)
  assert.match(admin.detail, /always can view/)
  const guestGranted = getReceiptViewStatus({ member: trip.members[2], trip, viewerIds: ['guest'] })
  const guestDenied = getReceiptViewStatus({ member: trip.members[2], trip, viewerIds: [] })
  assert.equal(guestGranted.enabled, true)
  assert.equal(guestGranted.detail, 'Can view receipts')
  assert.equal(guestDenied.label, 'Receipt access disabled')
  assert.equal(getMemberGroupRoles({ uid: 'long-name', name: trip.members[3].name }, trip, []).roles[0].label, 'Member')
})
