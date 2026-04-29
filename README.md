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
   - Email/Password
   - Google provider
3. Create a Firestore database.
4. Create a Firebase Storage bucket.
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
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
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

## Firestore model

### `users/{uid}`

- `name`
- `email`
- `photoURL`
- `createdAt`

### `trips/{tripId}`

- `name`
- `description`
- `emoji`
- `startDate`
- `endDate`
- `currency`
- `createdBy`
- `members`
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
- Receipt uploads are stored in Firebase Storage under `receipts/{tripId}/...`.
- Trip listing uses `memberIds` and admin checks use `adminIds` as derived Firestore fields for fast queries and rules.
