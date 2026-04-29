import toast from 'react-hot-toast'

const ERROR_MESSAGES = {
  'auth/configuration-not-found':
    'Firebase Authentication is not fully configured. In Firebase Console, open Authentication, click Get started, and enable the sign-in methods you want to use.',
  'auth/email-already-in-use': 'That email is already registered.',
  'auth/invalid-credential': 'That email or password did not match.',
  'auth/invalid-api-key':
    'This Firebase API key is not valid for Authentication. Double-check the web app config in your .env file.',
  'auth/operation-not-allowed':
    'That sign-in method is disabled in Firebase Authentication. Enable it in Firebase Console first.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/unauthorized-domain':
    'This domain is not authorized for Firebase Authentication. Add localhost or your deployed domain in Firebase Console > Authentication > Settings.',
  'storage/canceled': 'The file upload was canceled before it finished.',
  'storage/retry-limit-exceeded':
    'The receipt upload kept failing. Check your network and Firebase Storage setup, then try again.',
  'storage/unauthenticated':
    'You need to be signed in before uploading a receipt.',
  'storage/unknown':
    'Cloud Storage upload failed. Confirm that Firebase Storage is created, storage rules are deployed, and the project is on the Blaze plan for web uploads.',
  'storage/unauthorized': 'You do not have permission to upload that receipt.',
  'permission-denied':
    'Firestore denied this action. Make sure Firestore exists, deploy the included security rules, and confirm the signed-in user is allowed by those rules.',
  unavailable: 'Firebase is unavailable right now. Please try again.',
}

export const getErrorMessage = (error, fallback = 'Something went wrong.') =>
  ERROR_MESSAGES[error?.code] || ERROR_MESSAGES[error?.message] || error?.message || fallback

export const notifyFirebaseError = (error, fallback) => {
  const message = getErrorMessage(error, fallback)
  toast.error(message)
  return message
}
