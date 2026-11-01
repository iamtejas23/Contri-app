# Private ImageKit receipts

Contri uploads JPEG, PNG and WebP receipt images directly from the browser or Capacitor WebView to ImageKit. The application requests a short-lived ImageKit upload signature from the Vercel Functions under `api/imagekit/`. The private API key is used only by those functions; it is not included in Vite output or the APK.

## Authorization and privacy

- The signing endpoint verifies the Firebase ID token with Firebase Authentication's `accounts:lookup` endpoint.
- It reads the trip and expense through Firestore REST using that same user's bearer token. Firestore security rules therefore remain the authority for reads.
- It issues upload parameters only when the verified email is `tsmane8787@gmail.com` and the Firestore trip's `createdBy` UID matches the authenticated UID. A missing creator field, a different creator, an unverified account, or a missing expense is rejected.
- The client requests a private upload and, before adding metadata, calls a second server endpoint. That endpoint fetches ImageKit's stored file details and accepts only a private JPEG/PNG/WebP file under that exact trip/expense path and at most 10 MB. Invalid uploads are deleted through the ImageKit API and never attached to Firestore. Receipt metadata stores only the verified ImageKit file ID/path, filename, MIME type, size and upload timestamp on the existing expense document under `receiptFiles`. Existing `receiptURL` links remain supported and untouched.
- Receipt delivery URLs are signed and expire after five minutes. Before signing, the function checks current trip membership through Firestore using the caller's token and verifies that the file ID remains attached to that expense. A guessed ImageKit URL is not stored or returned as a permanent URL.
- Receipt deletion is available to trip admins only. The endpoint checks current membership/admin data and confirms that the file ID is attached to the selected expense before calling ImageKit's delete API; the client then removes only that receipt metadata field.
- The function does not use Firebase Admin credentials or bypass Firestore rules. It performs no production data migration and does not change Firestore rules.

Important ImageKit limitation: its direct-upload signature authenticates the short-lived token/expiry, not all multipart upload fields such as `folder` and `isPrivateFile`. The server therefore verifies privacy and path immediately after upload and deletes/rejects nonconforming files before Firestore attachment. This post-upload check cannot prevent a deliberately modified client from making a non-private asset briefly accessible before verification/deletion. For strict prevention, configure and verify an ImageKit upload/path policy that forces private uploads for the receipt area, or use a trusted upload proxy (which would require a lower request-size limit than Vercel Functions allow). Do not enable a broad root policy without checking its effect on other ImageKit assets. Keep the ImageKit private API key restricted to Vercel and periodically review the Media Library. Do not expose the private key in the client.

## Vercel configuration required

GitHub Actions secrets do not become Vercel Function environment variables automatically. In the linked Vercel project `contri-app`, open **Settings → Environment Variables** and add the existing values without changing or recreating them:

| Vercel variable | Value source | Environments |
|---|---|---|
| `IMAGEKIT_PUBLIC_KEY` | Existing GitHub secret with the same name | Production, Preview |
| `IMAGEKIT_PRIVATE_KEY` | Existing GitHub secret with the same name | Production, Preview |
| `IMAGEKIT_URL_ENDPOINT` | Existing GitHub secret with the same name | Production, Preview |
| `FIREBASE_PROJECT_ID` | Existing `VITE_FIREBASE_PROJECT_ID` project ID | Production, Preview |
| `FIREBASE_WEB_API_KEY` | Existing `VITE_FIREBASE_API_KEY` public Firebase web API key | Production, Preview |
| `IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED` | Set to literal `true` only after the ImageKit receipt path policy has been verified | Production, Preview |

The Firebase Web API key is the app's existing public Firebase client configuration, not a private credential. The two Firebase aliases make it available to the serverless runtime; no service account/private Firebase key is required. Keep ImageKit's private key marked **Sensitive** in Vercel. Re-deploy the existing Vercel project after adding the variables so the Functions receive them. Do not add the private key under any `VITE_` variable name.

If using a Vercel preview/custom domain, add its exact HTTPS origin to `APP_ORIGINS` as a comma-separated list. Do not use `*`. The production Vercel origin and Capacitor localhost origins are already allow-listed.

For local Vercel Function development, use `vercel dev` after adding the variables to the linked project's local environment. Do not copy the ImageKit private key into `.env`, Vite configuration, Android assets, or Git. For a different API host during local web testing, set `VITE_RECEIPT_API_BASE_URL` to that trusted HTTPS origin. The Android app defaults to `https://contri-app.vercel.app`.

## Client behavior

Receipt images may be up to 10 MB and must be JPEG, PNG or WebP. The original upload is preserved in ImageKit. Member previews use short-lived signed WebP transformations (lazy-loaded), while the original signed file remains available to open/download. Camera capture and gallery selection are separate on Android; browsers use the standard image file picker.

## Deployment and test checklist

1. Configure an ImageKit policy covering the receipt upload path that forces `isPrivateFile=true` (and rejects unsupported sizes/types if the policy supports those checks). Test it with a modified upload request and verify the resulting file is private before marking the policy as confirmed.
2. Add the Vercel runtime variables above, including `IMAGEKIT_RECEIPTS_PRIVATE_POLICY_CONFIRMED=true` only after that test passes, then deploy through the existing Vercel Git integration. Without the confirmation variable, the API deliberately refuses to issue upload signatures.
3. Do not deploy Firestore rules for this integration.
4. Use the Firebase Emulator suite for API authorization tests; these tests use disposable users and records only.
5. Validate a test upload with the designated account on a disposable trip. Confirm the ImageKit asset is marked private and that the unsigned original URL is denied.
6. Verify a current trip member can open the signed view URL, an outsider cannot get one, and the URL expires after five minutes.
7. Verify the upload and preview flow from an Android device because camera/gallery chooser behavior cannot be proven by a frontend build alone.
