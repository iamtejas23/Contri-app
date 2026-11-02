const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const mimeFromFormat = (format) => {
  const value = String(format || '').toLowerCase().replace(/^image\//, '')
  if (value === 'jpg' || value === 'jpeg') return 'image/jpeg'
  if (value === 'png') return 'image/png'
  if (value === 'webp') return 'image/webp'
  return ''
}

const detectImageMime = async (blob) => {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return ''
}

const decodeBase64Image = (value, mimeType, maxBytes) => {
  const encoded = String(value || '').replace(/^data:[^,]*;base64,/, '').replace(/\s/g, '')
  if (!encoded) throw new Error('The camera returned an empty image. Try capturing it again.')
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const byteLength = Math.floor(encoded.length * 3 / 4) - padding
  if (byteLength > maxBytes) throw new Error('The captured image is larger than 5 MB. Retake it at a lower camera resolution.')
  const binary = globalThis.atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

/** Convert the plugin's short-lived camera result into the File shape used by the existing queue. */
export const cameraPhotoToReceiptFile = async (photo, {
  fetchImpl = globalThis.fetch,
  readFile,
  maxBytes = MAX_RECEIPT_BYTES,
  now = Date.now,
} = {}) => {
  if (!photo || (!photo.webPath && !photo.path)) {
    throw new Error('The camera did not return an image. Please capture the receipt again.')
  }

  const declaredMime = mimeFromFormat(photo.format)
  let blob = null
  if (photo.webPath && fetchImpl) {
    try {
      const response = await fetchImpl(photo.webPath)
      if (!response.ok) throw new Error('Could not read the captured image.')
      blob = await response.blob()
    } catch {
      // Native file URLs can differ across Android WebView versions. Fall back to
      // Capacitor Filesystem using the URI without retaining base64 in app state.
    }
  }

  let mimeType = String(blob?.type || '').toLowerCase()
  if (!MIME_TYPES.has(mimeType)) mimeType = declaredMime
  if (blob && blob.size > maxBytes) {
    throw new Error('The captured image is larger than 5 MB. Retake it at a lower camera resolution.')
  }

  if ((!blob || !blob.size || !MIME_TYPES.has(mimeType)) && photo.path && readFile) {
    const result = await readFile({ path: photo.path })
    const data = typeof result?.data === 'string' ? result.data : ''
    blob = decodeBase64Image(data, declaredMime || mimeType, maxBytes)
    mimeType = declaredMime || mimeType
  }

  if (!blob?.size) throw new Error('The captured image could not be read. Please try again.')
  const actualMime = await detectImageMime(blob)
  if (!MIME_TYPES.has(actualMime) || (mimeType && actualMime !== mimeType)) {
    throw new Error('The camera returned an unsupported or invalid image format. Retake the receipt as a JPEG or PNG.')
  }
  if (blob.size > maxBytes) throw new Error('The captured image is larger than 5 MB. Retake it at a lower camera resolution.')

  const extension = actualMime === 'image/png' ? 'png' : actualMime === 'image/webp' ? 'webp' : 'jpg'
  const timestamp = now()
  return new File([blob], `receipt-${timestamp}.${extension}`, { type: actualMime, lastModified: timestamp })
}
