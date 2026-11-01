import { createClient } from '@supabase/supabase-js'
import process from 'node:process'

export const RECEIPT_BUCKET = 'contri-receipts'
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
export const RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const required = (name, value) => {
  if (!value) throw Object.assign(new Error(`${name} is not configured for the Vercel Function.`), { statusCode: 503 })
  return value
}

export const createReceiptStorage = ({ fetchImpl } = {}) => {
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
  const url = required('VITE_SUPABASE_URL', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  }).storage.from(RECEIPT_BUCKET)
}

export const validateReceiptPath = ({ path, tripId, expenseId }) => {
  const prefix = `trips/${tripId}/expenses/${expenseId}/`
  if (typeof path !== 'string' || !path.startsWith(prefix) || path.length > 500 || path.includes('..') || path.includes('\\')) {
    throw Object.assign(new Error('This receipt is not attached to the selected expense.'), { statusCode: 404 })
  }
  return path
}

export const getReceiptFile = (expense, fileId, tripId, expenseId) => {
  const receipt = expense?.receiptFiles?.[fileId]
  if (!receipt || receipt.fileId !== fileId || receipt.provider !== 'supabase' || receipt.bucket !== RECEIPT_BUCKET) {
    throw Object.assign(new Error('This receipt is no longer attached to the expense.'), { statusCode: 404 })
  }
  validateReceiptPath({ path: receipt.path, tripId, expenseId })
  const expectedBase = `trips/${tripId}/expenses/${expenseId}/${fileId}.`
  if (!['jpg', 'png', 'webp'].some((extension) => receipt.path === `${expectedBase}${extension}`)) {
    throw Object.assign(new Error('This receipt is not attached to the selected expense.'), { statusCode: 404 })
  }
  return receipt
}
