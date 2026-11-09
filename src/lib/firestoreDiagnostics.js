const DEFAULT_LOGGER = typeof console === 'undefined' ? { warn() {} } : console

const SAFE_CODES = new Set([
  'permission-denied',
  'not-found',
  'unauthenticated',
  'unavailable',
  'failed-precondition',
  'aborted',
  'deadline-exceeded',
  'resource-exhausted',
  'cancelled',
  'internal',
  'unknown',
])

export const logFirestoreOperationError = (
  { operation, path, code } = {},
  logger = DEFAULT_LOGGER,
) => {
  const safeCode = SAFE_CODES.has(code) ? code : (typeof code === 'string' && code ? 'other' : 'unknown')
  logger.warn('[contri:firestore]', {
    operation: typeof operation === 'string' ? operation : 'unknown',
    path: typeof path === 'string' ? path : 'unknown',
    code: safeCode,
  })
}
