import { FieldPath, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { auth, db } from '../firebase/config'

const configuredBase = String(import.meta.env.VITE_RECEIPT_API_BASE_URL || '').trim()
const defaultNativeBase = 'https://contri-app.vercel.app'
const apiBase = configuredBase.replace(/\/$/, '')

const getApiUrl = (route) => `${apiBase || defaultNativeBase}/api/imagekit/${route}`

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

const uploadWithProgress = ({ file, authParams, onProgress, signal }) => new Promise((resolve, reject) => {
  const body = new FormData()
  body.append('file', file)
  body.append('fileName', authParams.fileName)
  body.append('folder', authParams.folder)
  body.append('publicKey', authParams.publicKey)
  body.append('token', authParams.token)
  body.append('expire', String(authParams.expire))
  body.append('signature', authParams.signature)
  body.append('isPrivateFile', 'true')
  body.append('useUniqueFileName', 'true')

  const xhr = new XMLHttpRequest()
  xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload')
  xhr.responseType = 'json'
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
  }
  xhr.onload = () => {
    const result = xhr.response || (() => {
      try { return JSON.parse(xhr.responseText) } catch { return {} }
    })()
    if (xhr.status < 200 || xhr.status >= 300) {
      reject(new Error(result.message || 'ImageKit could not upload this receipt. Try again.'))
      return
    }
    if (!result.fileId || !result.filePath) {
      reject(new Error('ImageKit returned incomplete receipt information.'))
      return
    }
    resolve(result)
  }
  xhr.onerror = () => reject(new Error('Receipt upload failed due to a network error.'))
  xhr.onabort = () => reject(new Error('Receipt upload was cancelled.'))
  if (signal) {
    if (signal.aborted) return reject(new Error('Receipt upload was cancelled.'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
  }
  xhr.send(body)
})

export const uploadImageKitReceipt = async ({ tripId, expenseId, file, onProgress, signal }) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file?.type)) throw new Error('Choose a JPEG, PNG or WebP image.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Receipt images must be 10 MB or smaller.')

  const authParams = await requestReceiptApi('auth', { tripId, expenseId, mimeType: file.type })
  const uploaded = await uploadWithProgress({ file, authParams, onProgress, signal })
  const verified = await requestReceiptApi('verify', { tripId, expenseId, fileId: uploaded.fileId })
  return verified.receipt
}

export const attachReceiptMetadata = async ({ tripId, expenseId, receipt }) => {
  const ref = doc(db, 'trips', tripId, 'expenses', expenseId)
  await updateDoc(ref, new FieldPath('receiptFiles', receipt.fileId), {
    ...receipt,
    uploadedAt: serverTimestamp(),
  })
}

export const getImageKitReceiptUrls = ({ tripId, expenseId, fileId }) =>
  requestReceiptApi('url', { tripId, expenseId, fileId })

export const deleteImageKitReceipt = async ({ tripId, expenseId, receipt }) => {
  await requestReceiptApi('delete', { tripId, expenseId, fileId: receipt.fileId })
  const ref = doc(db, 'trips', tripId, 'expenses', expenseId)
  await updateDoc(ref, new FieldPath('receiptFiles', receipt.fileId), deleteField())
}

export const getImageKitReceiptList = (expense) => {
  const value = expense?.receiptFiles
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.values(value).filter((receipt) => receipt?.fileId && receipt?.filePath)
}
