const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const TYPE_BY_EXTENSION = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export const createReceiptUploadId = () => {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  if (!cryptoApi?.getRandomValues) throw new Error('Secure upload retry is unavailable in this browser. Update the app and try again.')
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const getReceiptMimeType = (file) => {
  const supplied = String(file?.type || '').toLowerCase()
  if (ALLOWED_TYPES.has(supplied)) return supplied
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase()
  return TYPE_BY_EXTENSION[extension] || ''
}

