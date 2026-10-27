const FIREBASE_ERROR_MAP: Record<string, string> = {
  'auth/user-disabled': 'This account has been disabled.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/operation-not-allowed':
    'Google sign-in is not enabled. In Firebase Console → Authentication → Sign-in method, enable Google.',
  'auth/invalid-phone-number': 'That phone number does not look right.',
  'auth/missing-phone-number': 'Enter your mobile number.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/quota-exceeded': 'SMS quota exceeded. Try again later.',
  'auth/code-expired': 'That OTP expired. Request a new one.',
  'auth/invalid-verification-code': 'Invalid OTP. Please try again.',
  'auth/session-expired': 'OTP session expired. Request a new one.',
  'auth/captcha-check-failed': 'reCAPTCHA failed. Try again.',
  'permission-denied': 'Missing or insufficient permissions.',
}

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong.') => {
  if (!error || typeof error !== 'object') return fallback
  const code = 'code' in error ? String((error as { code?: string }).code || '') : ''
  const message =
    'message' in error ? String((error as { message?: string }).message || '') : ''
  return FIREBASE_ERROR_MAP[code] || message || fallback
}
