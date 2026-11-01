import assert from 'node:assert/strict'
import test from 'node:test'

import { createReceiptUploadId, getReceiptMimeType } from '../src/lib/receiptFile.js'

test('receipt MIME detection accepts the bucket allowlist and handles Android files with empty MIME types', () => {
  assert.equal(getReceiptMimeType({ type: 'image/jpeg', name: 'photo.jpg' }), 'image/jpeg')
  assert.equal(getReceiptMimeType({ type: 'image/png', name: 'camera.png' }), 'image/png')
  assert.equal(getReceiptMimeType({ type: 'image/webp', name: 'scan.webp' }), 'image/webp')
  assert.equal(getReceiptMimeType({ type: '', name: '1000147127.PNG' }), 'image/png')
  assert.equal(getReceiptMimeType({ type: 'application/octet-stream', name: 'receipt.jpeg' }), 'image/jpeg')
})

test('receipt MIME detection rejects types outside the private bucket allowlist', () => {
  assert.equal(getReceiptMimeType({ type: 'application/pdf', name: 'receipt.pdf' }), '')
  assert.equal(getReceiptMimeType({ type: '', name: 'receipt.gif' }), '')
})

test('receipt retry identifiers are random UUIDs suitable for a single object path', () => {
  assert.match(createReceiptUploadId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})
