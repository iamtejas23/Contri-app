import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraPhotoToReceiptFile } from '../src/lib/cameraReceiptFile.js'
import { captureReceiptWithNativeCamera, getCameraCaptureErrorMessage, isCameraCaptureCancelled } from '../src/services/receiptCamera.js'

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])

test('native camera result becomes a validated JPEG File from its WebView-readable URL', async () => {
  const file = await cameraPhotoToReceiptFile({ webPath: 'capacitor://localhost/_capacitor_file_/receipt.jpg', format: 'jpeg' }, {
    fetchImpl: async () => ({ ok: true, blob: async () => new Blob([jpegBytes], { type: 'image/jpeg' }) }),
    now: () => 123,
  })
  assert.equal(file.name, 'receipt-123.jpg')
  assert.equal(file.type, 'image/jpeg')
  assert.equal(file.size, jpegBytes.length)
})

test('native file URI falls back to Filesystem without retaining base64 in the returned File', async () => {
  const base64 = globalThis.btoa(String.fromCharCode(...jpegBytes))
  const file = await cameraPhotoToReceiptFile({ path: 'file:///private/receipt.jpg', format: 'jpeg' }, {
    fetchImpl: async () => { throw new Error('WebView file URI fetch unsupported') },
    readFile: async ({ path }) => { assert.equal(path, 'file:///private/receipt.jpg'); return { data: base64 } },
    now: () => 456,
  })
  assert.equal(file.type, 'image/jpeg')
  assert.equal(file.size, jpegBytes.length)
})

test('camera result rejects missing, invalid and over-limit image data', async () => {
  await assert.rejects(cameraPhotoToReceiptFile(null), /did not return an image/)
  await assert.rejects(cameraPhotoToReceiptFile({ webPath: '/bad', format: 'jpeg' }, {
    fetchImpl: async () => ({ ok: true, blob: async () => new Blob(['not an image'], { type: 'image/jpeg' }) }),
  }), /invalid image format/)
  const largeJpeg = new Blob([jpegBytes, new Uint8Array(5 * 1024 * 1024)], { type: 'image/jpeg' })
  await assert.rejects(cameraPhotoToReceiptFile({ webPath: '/large', format: 'jpeg' }, {
    fetchImpl: async () => ({ ok: true, blob: async () => largeJpeg }),
  }), /larger than 5 MB/)
})

test('camera asks for runtime permission before opening capture and reports denial with Settings guidance', async () => {
  const calls = []
  const camera = {
    async checkPermissions() { calls.push('check'); return { camera: 'prompt' } },
    async requestPermissions(options) { calls.push(options); return { camera: 'granted' } },
    async getPhoto(options) { calls.push(options); return { webPath: '/captured', format: 'jpeg' } },
  }
  const file = await captureReceiptWithNativeCamera({ camera, fetchImpl: async () => ({ ok: true, blob: async () => new Blob([jpegBytes], { type: 'image/jpeg' }) }) })
  assert.equal(file.type, 'image/jpeg')
  assert.equal(calls[0], 'check')
  assert.deepEqual(calls[1], { permissions: ['camera'] })
  assert.equal(calls[2].source, 'CAMERA')
  assert.equal(calls[2].resultType, 'uri')
  assert.equal(calls[2].quality, 92)

  let launched = false
  await assert.rejects(captureReceiptWithNativeCamera({ camera: {
    async checkPermissions() { return { camera: 'denied' } },
    async requestPermissions() { return { camera: 'denied' } },
    async getPhoto() { launched = true; return null },
  } }), (error) => {
    assert.equal(error.code, 'CAMERA_PERMISSION_DENIED')
    assert.match(getCameraCaptureErrorMessage(error), /Android Settings/)
    return true
  })
  assert.equal(launched, false)
})

test('camera cancellation is recognized and does not need to surface as an upload error', () => {
  assert.equal(isCameraCaptureCancelled(new Error('User cancelled photos app')), true)
  assert.equal(isCameraCaptureCancelled(Object.assign(new Error('Capture stopped'), { code: 'OS-PLUG-CAMR-0006' })), true)
  assert.equal(isCameraCaptureCancelled(new Error('Camera unavailable')), false)
})
