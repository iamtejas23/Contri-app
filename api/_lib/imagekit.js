import { createHmac, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw Object.assign(new Error(`${name} is not configured for the Vercel Function.`), { statusCode: 503 })
  return value
}

export const createUploadAuth = () => {
  const privateKey = required('IMAGEKIT_PRIVATE_KEY')
  const publicKey = required('IMAGEKIT_PUBLIC_KEY')
  const token = randomUUID()
  const expire = Math.floor(Date.now() / 1000) + 300
  const signature = createHmac('sha1', privateKey).update(`${token}${expire}`).digest('hex')
  return { token, expire, signature, publicKey }
}

export const createSignedDeliveryUrl = ({ filePath, transformation = '', expiresIn = 300 }) => {
  const endpoint = new URL(required('IMAGEKIT_URL_ENDPOINT'))
  if (endpoint.protocol !== 'https:') throw Object.assign(new Error('ImageKit URL endpoint must use HTTPS.'), { statusCode: 503 })
  const normalizedPath = String(filePath || '').replace(/^\/+/, '')
  if (!normalizedPath || normalizedPath.split('/').some((part) => part === '..')) {
    throw Object.assign(new Error('Receipt file path is invalid.'), { statusCode: 400 })
  }
  const relativePath = `${transformation ? `${transformation}/` : ''}${normalizedPath}`
  const expire = Math.floor(Date.now() / 1000) + expiresIn
  const signature = createHmac('sha1', required('IMAGEKIT_PRIVATE_KEY')).update(`${relativePath}${expire}`).digest('hex')
  const base = endpoint.toString().replace(/\/+$/, '')
  return `${base}/${relativePath}?ik-t=${expire}&ik-s=${signature}`
}

export const createSignedDownloadUrl = (options) =>
  `${createSignedDeliveryUrl(options)}&ik-attachment=true&ik-attachment-filename=contri-receipt`

export const deleteImageKitFile = async (fileId, fetchImpl = fetch) => {
  const privateKey = required('IMAGEKIT_PRIVATE_KEY')
  const authorization = Buffer.from(`${privateKey}:`).toString('base64')
  const response = await fetchImpl(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${authorization}` },
  })
  if (response.ok || response.status === 404) return
  throw Object.assign(new Error('ImageKit could not delete the receipt. Try again.'), { statusCode: 502 })
}

export const getImageKitFileDetails = async (fileId, fetchImpl = fetch) => {
  const privateKey = required('IMAGEKIT_PRIVATE_KEY')
  const authorization = Buffer.from(`${privateKey}:`).toString('base64')
  const response = await fetchImpl(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
    headers: { Authorization: `Basic ${authorization}` },
  })
  if (!response.ok) throw Object.assign(new Error('ImageKit could not verify the uploaded receipt.'), { statusCode: 502 })
  return response.json()
}
