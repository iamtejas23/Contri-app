import assert from 'node:assert/strict'
import { test } from 'node:test'

import { firebaseAuthHandlerUrl, resolveFirebaseAuthDomain } from '../src/lib/firebaseAuthDomain.js'

test('Google popup continue URI follows the same project as projectId, not a leftover Auth domain', () => {
  assert.equal(
    resolveFirebaseAuthDomain('contri-app-33f5a', 'contri-app-cc4f6.firebaseapp.com'),
    'contri-app-33f5a.firebaseapp.com',
  )
  assert.equal(
    firebaseAuthHandlerUrl(resolveFirebaseAuthDomain('contri-app-33f5a', 'contri-app-cc4f6.firebaseapp.com')),
    'https://contri-app-33f5a.firebaseapp.com/__/auth/handler',
  )
  assert.equal(
    firebaseAuthHandlerUrl('contri-app-cc4f6.firebaseapp.com'),
    'https://contri-app-cc4f6.firebaseapp.com/__/auth/handler',
  )
})

test('matching firebaseapp.com or web.app Auth domains are kept', () => {
  assert.equal(
    resolveFirebaseAuthDomain('contri-app-33f5a', 'contri-app-33f5a.firebaseapp.com'),
    'contri-app-33f5a.firebaseapp.com',
  )
  assert.equal(
    resolveFirebaseAuthDomain('contri-app-33f5a', 'https://contri-app-33f5a.web.app/'),
    'contri-app-33f5a.web.app',
  )
})

test('Vercel app origin is not used as the Auth continue domain', () => {
  assert.equal(
    resolveFirebaseAuthDomain('contri-app-33f5a', 'contri-app.vercel.app'),
    'contri-app-33f5a.firebaseapp.com',
  )
})
