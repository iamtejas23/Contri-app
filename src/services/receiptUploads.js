import { FieldPath, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { auth, db } from '../firebase/config'
import { createReceiptUploadId, getReceiptMimeType } from '../lib/receiptFile'
import { requestReceiptApiWithAuth } from '../lib/receiptApiClient'

export const RECEIPT_BUCKET = 'contri-receipts'
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
const configuredBase = String(import.meta.env.VITE_RECEIPT_API_BASE_URL || '').trim()
const apiBase = configuredBase.replace(/\/$/, '')
const defaultNativeBase = 'https://contri-app.vercel.app'
const getApiUrl = (route) => `${apiBase || defaultNativeBase}/api/supabase/${route}`

const requestReceiptApi = async (route, payload) => {
  // Read the current Firebase JS SDK user for each request; Capacitor Google sign-in
  // uses skipNativeAuth and stores the credential in this same Firebase Auth instance.
  await auth.authStateReady?.()
  return requestReceiptApiWithAuth({ user: auth.currentUser, url: getApiUrl(route), payload })
}

const asTypedFile = (file, mimeType) => file.type === mimeType
  ? file
  : new File([file], file.name || `receipt.${mimeType.split('/')[1]}`, { type: mimeType, lastModified: file.lastModified })

const uploadWithProgress = ({ file, uploadInfo, mimeType, onProgress, signal }) => new Promise((resolve, reject) => {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!supabaseUrl || !anonKey) {
    reject(new Error('Receipt storage is not configured in this app build.'))
    return
  }

  let settled = false
  const path = uploadInfo.path.split('/').map(encodeURIComponent).join('/')
  const url = new URL(`/storage/v1/object/upload/sign/${encodeURIComponent(RECEIPT_BUCKET)}/${path}`, supabaseUrl)
  url.searchParams.set('token', uploadInfo.token)
  const xhr = new XMLHttpRequest()
  const finish = (callback, value) => {
    if (settled) return
    settled = true
    signal?.removeEventListener('abort', abort)
    callback(value)
  }
  const readFailure = () => {
    let details = {}
    try { details = JSON.parse(xhr.responseText || '{}') } catch { /* use HTTP status below */ }
    const status = xhr.status
    if (status === 413 || status === 400) {
      return new Error(details.message || details.error || 'Supabase rejected the image. Check that it is JPEG, PNG or WebP and no larger than 5 MB.')
    }
    if (status === 401 || status === 403) return new Error('Supabase rejected the signed upload. Check the storage configuration and request a fresh upload token.')
    if (status === 409) return new Error('This receipt upload already exists. Retry the same image to finish attaching it.')
    if (status >= 500) return new Error('Supabase Storage is temporarily unavailable. Retry this same image in a moment.')
    return new Error(details.message || details.error || `Receipt upload failed (HTTP ${status || 'network error'}). Check your connection and retry.`)
  }
  const abort = () => {
    xhr.abort()
    finish(reject, new Error('Receipt upload was cancelled.'))
  }
  if (signal?.aborted) {
    abort()
    return
  }
  signal?.addEventListener('abort', abort, { once: true })
  xhr.open('PUT', url.toString())
  xhr.timeout = 120_000
  xhr.setRequestHeader('apikey', anonKey)
  xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`)
  xhr.setRequestHeader('x-upsert', 'false')
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
  }
  xhr.onload = () => xhr.status >= 200 && xhr.status < 300
    ? finish(resolve, true)
    : finish(reject, readFailure())
  xhr.onerror = () => finish(reject, new Error('Upload was interrupted by a network or storage connection error. Retry this same image; it will not create a second object.'))
  xhr.ontimeout = () => finish(reject, new Error('Upload timed out. Check your connection and retry this same image.'))
  xhr.onabort = () => finish(reject, new Error('Receipt upload was cancelled.'))
  const form = new FormData()
  form.append('cacheControl', '3600')
  form.append('', asTypedFile(file, mimeType))
  xhr.send(form)
})

export const uploadSupabaseReceipt = async ({ tripId, expenseId, file, fileId = createReceiptUploadId(), onProgress, signal }) => {
  if (!String(import.meta.env.VITE_SUPABASE_URL || '').trim()
    || !String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()) {
    throw new Error('Receipt storage is not configured in this app build. Ask the app administrator to finish Supabase setup.')
  }
  const mimeType = getReceiptMimeType(file)
  if (!mimeType) throw new Error('Choose a JPEG, PNG or WebP image. This device did not provide a supported image type.')
  if (file.size > MAX_RECEIPT_BYTES) throw new Error('Receipt images must be 5 MB or smaller.')
  if (!file.size) throw new Error('Choose an image with content.')

  const uploadInfo = await requestReceiptApi('upload', {
    tripId,
    expenseId,
    fileId,
    mimeType,
    fileName: file.name,
    size: file.size,
  })
  if (!uploadInfo.alreadyUploaded) await uploadWithProgress({ file, uploadInfo, mimeType, onProgress, signal })
  const verified = await requestReceiptApi('verify', {
    tripId,
    expenseId,
    fileId: uploadInfo.fileId,
    path: uploadInfo.path,
    mimeType,
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
