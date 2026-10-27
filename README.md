# Contri-app

Split trips, not friendships.

Contri-app is a Firebase-powered React app for planning shared trips, tracking expenses in real time, simplifying debts, recording settlements, and exporting summaries without a custom backend.

## Tech stack

- React 18 + Vite
- Firebase Auth, Firestore, Storage
- Tailwind CSS
- React Router v6
- Recharts
- jsPDF + `jspdf-autotable`
- Papa Parse
- `react-hot-toast`
- `date-fns`

## Firebase setup

1. Create a Firebase project in the Firebase console.
2. Enable Authentication:
   - Google provider
   - Anonymous (lets invitees join a trip from its link without creating an account)
3. Create a Firestore database.
4. Create a Firebase Storage bucket.
   - Cloud Storage for Firebase on web requires the project to be on the Blaze plan.
5. Copy the Firebase web app credentials into a local `.env` file based on `.env.example`.
6. Deploy the included security rules:
   - `firestore.rules`
   - `storage.rules`

## Deploy Firebase rules

If you see `Missing or insufficient permissions` in the browser, your Firebase rules are usually not deployed yet.

1. Install the Firebase CLI:
   - `npm install -g firebase-tools`
2. Log in:
   - `firebase login`
3. Initialize the project in this folder if needed:
   - `firebase use --add`
4. Deploy the included rules:
   - `firebase deploy --only firestore:rules,storage`

## Environment variables

Create `.env` in the project root:

```bash
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Install and run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Android app

Contri packages the same Vite web app in a Capacitor Android shell. Firebase Auth and Firestore remain the backend; no Android-specific API server or database is introduced.

1. Install Node 20 or newer, Java 21, Android SDK Platform 36, and Android build tools. Set `ANDROID_HOME` and `ANDROID_SDK_ROOT` to your SDK directory.
2. Set the Firebase web app values in `.env`. Download the Android client configuration from the existing Firebase Android app registered as `com.contriapp.mobile`; `android/app/google-services.json` is ignored by Git:

   ```bash
   firebase apps:sdkconfig ANDROID 1:11047230183:android:138f233651f12bce8aa042 --out android/app/google-services.json
   ```
3. Build and sync the app, then assemble a debug APK:

   ```bash
   npm run build
   npx cap sync android
   ANDROID_HOME=/path/to/Android/Sdk ANDROID_SDK_ROOT=/path/to/Android/Sdk npm run android:debug
   ```

   The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a connected device with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

Android Google sign-in uses the native Firebase Authentication plugin and signs the returned Google credential into the existing Firebase JavaScript Auth session. The production Android Firebase app must have the signing certificate SHA-1/SHA-256 registered, and the Google provider must be enabled in Firebase Authentication. Web sign-in continues to use Firebase popup authentication. Native sharing and UPI app launch use Android intents; CSV/PDF exports open the Android share sheet. Re-run `npx cap sync android` after web builds or native dependency changes.

Regenerate the launcher icon and splash assets after changing `resources/icon.png` or `resources/splash.png` with `npm run assets:android`.

## Firestore model

### `users/{uid}`

- `name`
- `email`
- `photoURL`
- `upiId` (optional, for one-tap UPI settlements)
- `createdAt`

### `trips/{tripId}`

- `name`
- `description`
- `emoji`
- `startDate`
- `endDate`
- `currency`
- `budget` (optional trip spend cap)
- `createdBy`
- `members` (includes optional `upiId` per member)
- `memberIds`
- `adminIds`
- `createdAt`
- `updatedAt`

### `trips/{tripId}/expenses/{expenseId}`

- `title`
- `amount`
- `category`
- `paidBy`
- `date`
- `note`
- `splitMode`
- `splitAmong`
- `receiptURL`
- `createdAt`
- `updatedAt`

### `trips/{tripId}/settlements/{settlementId}`

- `from`
- `to`
- `amount`
- `method`
- `settledAt`
- `note`

### `trips/{tripId}/activity/{activityId}`

- `type`
- `actorUid`
- `actorName`
- `message`
- `timestamp`
- `meta`

## Notes

- `.env` is ignored by git and `.env.example` is committed.
- Receipt scanning reads the photo on-device via Tesseract in the browser; nothing is uploaded unless you paste a receipt link.
- Trip listing uses `memberIds` and admin checks use `adminIds` as derived Firestore fields for fast queries and rules.
- Any trip member can add expenses and record settlements; only admins can edit/delete expenses or manage the trip.
