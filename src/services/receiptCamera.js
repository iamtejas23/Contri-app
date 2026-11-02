import { Camera as CapacitorCamera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera'
import { Filesystem } from '@capacitor/filesystem'
import { cameraPhotoToReceiptFile } from '../lib/cameraReceiptFile.js'

export const PENDING_CAMERA_RECEIPT_KEY = 'contri.pendingReceiptCamera'
const permissionHelp = 'Camera permission is off. Enable it in Android Settings → Apps → Contri → Permissions → Camera, then try again.'

export const savePendingReceiptCapture = (target) => {
  try { globalThis.localStorage?.setItem(PENDING_CAMERA_RECEIPT_KEY, JSON.stringify({ ...target, startedAt: Date.now() })) } catch { /* Capture can proceed; only process-death recovery is unavailable. */ }
}

export const clearPendingReceiptCapture = () => {
  try { globalThis.localStorage?.removeItem(PENDING_CAMERA_RECEIPT_KEY) } catch { /* Ignore unavailable local storage. */ }
}

export const isCameraCaptureCancelled = (error) => {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()
  return code.includes('cancel') || code.endsWith('0006') || code.endsWith('0013') || message.includes('cancel')
}

export const getCameraCaptureErrorMessage = (error) => {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()
  if (code.includes('permission') || message.includes('permission') || message.includes('denied')) return permissionHelp
  if (code === 'camera_image_missing' || message.includes('larger than 5 mb') || message.includes('unsupported') || message.includes('could not be read')) return error.message
  if (code.includes('camera') && (code.includes('0007') || message.includes('no camera') || message.includes('unavailable'))) {
    return 'No camera is available on this device. Use Add Images to choose a receipt instead.'
  }
  return 'The camera could not capture a receipt. Please try again or use Add Images.'
}

export const captureReceiptWithNativeCamera = async ({
  camera = CapacitorCamera,
  filesystem = Filesystem,
  fetchImpl = globalThis.fetch,
  maxBytes,
  now,
} = {}) => {
  let permissions = await camera.checkPermissions()
  if (permissions.camera !== 'granted') {
    permissions = await camera.requestPermissions({ permissions: ['camera'] })
  }
  if (permissions.camera !== 'granted') {
    throw Object.assign(new Error(permissionHelp), { code: 'CAMERA_PERMISSION_DENIED' })
  }

  const photo = await camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Uri,
    direction: CameraDirection.Rear,
    quality: 92,
    width: 2560,
    height: 2560,
    correctOrientation: true,
    allowEditing: false,
    saveToGallery: false,
  })
  if (!photo?.webPath && !photo?.path) {
    throw Object.assign(new Error('The camera returned no image. Please capture the receipt again.'), { code: 'CAMERA_IMAGE_MISSING' })
  }
  return cameraPhotoToReceiptFile(photo, {
    fetchImpl,
    readFile: (options) => filesystem.readFile(options),
    ...(maxBytes ? { maxBytes } : {}),
    ...(now ? { now } : {}),
  })
}

