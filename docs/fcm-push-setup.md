# Android FCM push setup

Contri sends Android push messages from the existing Vercel API. Firebase Authentication and Firestore remain the source of truth. No Cloud Functions are used. In-app Firestore notifications continue independently.

## Vercel server environment

Set these for the Vercel project that serves the `/api/push/dispatch` function:

- `FIREBASE_PROJECT_ID`: `contri-app-33f5a`
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON key for a dedicated service account in the same Firebase project. Keep this as a Vercel server secret. A least-privilege starting point is `roles/firebasecloudmessaging.admin` (FCM send), `roles/firebaseauth.viewer` (revocation checks and recipient account state), and `roles/datastore.user` (Firestore reads/writes). `roles/datastore.user` can access all Firestore documents in the project because Admin SDK bypasses Firestore Rules; protect this key as a production database credential. A custom IAM role scoped to the exact required permissions can reduce that access further. Do not put it in any `VITE_` variable, GitHub Pages asset, or APK.
- `PUSH_ALLOWED_ORIGINS`: comma-separated exact origins. Include the deployed Contri web origin and `https://localhost` for the Capacitor Android WebView (include `http://localhost` only if that is the configured Android origin). Do not use `*`.

The Android app defaults to the existing `https://contri-app.vercel.app` API host. Set the public build-time `VITE_PUSH_API_BASE_URL` if the API is hosted at a different HTTPS origin. The web app uses its current origin when this is blank. `VITE_RECEIPT_API_BASE_URL` is also accepted as a fallback if it points to the same Vercel deployment.

## Firebase Console

1. In Firebase Console → Project Settings → General → Cloud Messaging, enable the Cloud Messaging API for project `contri-app-33f5a`. FCM delivery uses the no-cost FCM service; this implementation does not require Cloud Functions or Blaze billing.
2. Confirm the existing `android/app/google-services.json` is the configuration for that Android app. This repository already contains that project/package pairing.
3. In Google Cloud Console → IAM & Admin → Service Accounts, create a dedicated server identity, grant the roles above in project `contri-app-33f5a`, create a JSON key, and paste its full contents into Vercel's sensitive `FIREBASE_SERVICE_ACCOUNT_JSON` variable. Do not download a key into the repository or local frontend `.env`.
4. No Firestore rules deployment is performed by this change. Review and deploy the local `firestore.rules` change separately before enabling registration in a release.

## Device behavior

Push registration is off until a signed-in, non-anonymous Android user enables it in Settings. Android asks for notification permission at that moment. Tokens are stored only below `users/{uid}/deviceTokens/`; the user's own token record is removed when they turn push off or sign out. Messages use generic lock-screen text. Tapping opens the trip and relevant section; normal membership checks still control access.

## Local validation

The API tests use mocked Firebase Admin and FCM services. Emulator rules tests cover token ownership and guest denial. Do not send test messages to real users. After deployment, verify with an isolated test account and device; no production test is run as part of local setup.
