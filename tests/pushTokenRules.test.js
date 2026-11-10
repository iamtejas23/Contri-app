import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

let environment

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-contri-push-token-rules',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})

after(async () => environment?.cleanup())

test('only signed-in non-guest owner can create and delete their own token; reads stay private', async () => {
  const owner = environment.authenticatedContext('owner', { firebase: { sign_in_provider: 'google.com' } }).firestore()
  const other = environment.authenticatedContext('other', { firebase: { sign_in_provider: 'google.com' } }).firestore()
  const guest = environment.authenticatedContext('guest', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
  const path = doc(owner, 'users', 'owner', 'deviceTokens', 'token-hash')
  const value = { token: 'valid-long-fcm-token-value-123456', platform: 'android', soundEnabled: true, updatedAt: serverTimestamp() }

  await assertSucceeds(setDoc(path, value))
  await assertFails(getDoc(doc(other, 'users', 'owner', 'deviceTokens', 'token-hash')))
  await assertFails(setDoc(doc(other, 'users', 'owner', 'deviceTokens', 'other-token'), value))
  await assertFails(setDoc(doc(guest, 'users', 'guest', 'deviceTokens', 'guest-token'), value))
  await assertSucceeds(updateDoc(path, { soundEnabled: false, updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(other, 'users', 'owner', 'deviceTokens', 'token-hash'), { soundEnabled: true, updatedAt: serverTimestamp() }))
  await assertSucceeds(deleteDoc(path))
})
