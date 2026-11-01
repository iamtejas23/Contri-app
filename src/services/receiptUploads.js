import * as tus from 'tus-js-client'
import { FieldPath, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { auth, db } from '../firebase/config'

export const RECEIPT_BUCKET = 'contri-receipts'
export const MAX_RECEIPT_BYTES = 50_000_000
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const configuredBase = String(import.meta.env.VITE_RECEIPT_API_BASE_URL || '').trim()
const apiBase = configuredBase.replace(/\/$/, '')
const defaultNativeBase = 'https://contri-app.vercel.app'
const getApiUrl = (route) => `${apiBase || defaultNativeBase}/api/supabase/${route}`

const getIdToken = async () => {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in before managing receipts.')
  return user.getIdToken()
}

const requestReceiptApi = async (route, payload) => {
  let response
  try {
    response = await fetch(getApiUrl(route), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getIdToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Receipt service is unreachable. Check your connection and try again.')
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The receipt request failed. Please try again.')
  return result
}

const getTusEndpoint = (supabaseUrl) => {
  const parsed = new URL(supabaseUrl)
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('Supabase must use a secure HTTPS URL.')
  if (parsed.hostname.endsWith('.supabase.co')) {
    parsed.hostname = parsed.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co')
    parsed.pathname = ''
  }
  return `${parsed.origin}/storage/v1/upload/resumable`
}

const uploadWithProgress = ({ file, uploadInfo, onProgress, signal }) => new Promise((resolve, reject) => {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!supabaseUrl || !anonKey) {
    reject(new Error('Receipt storage is not configured in this app build.'))
    return
  }

  let settled = false
  const finish = (callback, value) => {
    if (settled) return
    settled = true
    signal?.removeEventListener('abort', abort)
    callback(value)
  }
  const upload = new tus.Upload(file, {
    endpoint: getTusEndpoint(supabaseUrl),
    chunkSize: 6 * 1024 * 1024,
    retryDelays: [0, 1000, 3000, 5000, 10000],
    removeFingerprintOnSuccess: true,
    uploadDataDuringCreation: true,
    headers: { apikey: anonKey, 'x-signature': uploadInfo.token },
    metadata: {
      bucketName: RECEIPT_BUCKET,
      objectName: uploadInfo.path,
      contentType: file.type,
      cacheControl: '3600',
    },
    onError: (error) => finish(reject, new Error(error.message || 'Receipt upload failed. Try again.')),
    onProgress: (bytesUploaded, bytesTotal) => onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100)),
    onSuccess: () => finish(resolve, true),
  })
  const abort = () => {
    upload.abort(true).finally(() => finish(reject, new Error('Receipt upload was cancelled.')))
  }
  if (signal?.aborted) {
    abort()
    return
  }
  signal?.addEventListener('abort', abort, { once: true })
  upload.start()
})

export const uploadSupabaseReceipt = async ({ tripId, expenseId, file, onProgress, signal }) => {
  if (!String(import.meta.env.VITE_SUPABASE_URL || '').trim()
    || !String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()) {
    throw new Error('Receipt storage is not configured in this app build. Ask the app administrator to finish Supabase setup.')
  }
  if (!ALLOWED_TYPES.has(file?.type)) throw new Error('Choose a JPEG, PNG or WebP image.')
  if (file.size > MAX_RECEIPT_BYTES) throw new Error('Receipt images must be 50 MB or smaller.')
  if (!file.size) throw new Error('Choose an image with content.')

  const uploadInfo = await requestReceiptApi('upload', {
    tripId,
    expenseId,
    mimeType: file.type,
    fileName: file.name,
    size: file.size,
  })
  await uploadWithProgress({ file, uploadInfo, onProgress, signal })
  const verified = await requestReceiptApi('verify', {
    tripId,
    expenseId,
    fileId: uploadInfo.fileId,
    path: uploadInfo.path,
    mimeType: file.type,
    fileName: uploadInfo.fileName || file.name,
  })
  return verified.receipt
}

export const attachReceiptMetadata = async ({ tripId, expenseId, receipt }) => {
  const ref = doc(db, 'trips', tripId, 'expenses', expenseId)
  await updateDoc(ref, new FieldPath('receiptFiles', receipt.fileId), {
    ...receipt,
    uploadedAt: serverTimestamp(),
  })
}

export const getSupabaseReceiptUrls = ({ tripId, expenseId, fileId }) =>
  requestReceiptApi('url', { tripId, expenseId, fileId })

export const deleteSupabaseReceipt = async ({ tripId, expenseId, receipt }) => {
  await requestReceiptApi('delete', { tripId, expenseId, fileId: receipt.fileId })
  const ref = doc(db, 'trips', tripId, 'expenses', expenseId)
  await updateDoc(ref, new FieldPath('receiptFiles', receipt.fileId), deleteField())
}

export const getSupabaseReceiptList = (expense) => {
  const value = expense?.receiptFiles
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.values(value).filter((receipt) => receipt?.provider === 'supabase'
    && receipt.bucket === RECEIPT_BUCKET && receipt.fileId && receipt.path)
}
