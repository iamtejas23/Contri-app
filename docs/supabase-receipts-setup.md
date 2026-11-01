# Private Supabase receipt storage

Contri keeps Firebase Authentication and Firestore as its identity and trip-data source. Supabase is used only as private object storage. The Vercel Functions verify Firebase ID tokens, read trip and expense documents through Firestore REST using the caller's token (so Firestore rules still apply), and use the Supabase service-role credential only to create object-scoped upload tokens, short-lived signed view/download URLs, and authorized deletes.

## Configure Supabase

1. In the Supabase dashboard, open the project intended for Contri and copy its **Project URL** and **anon/public key**. The anon key is a public client key; it is not the service-role key.
2. Open **Storage → New bucket** and create exactly `contri-receipts`.
3. Keep **Public bucket** disabled. Set the bucket's maximum file size to **5 MB** and allowed MIME types to `image/jpeg`, `image/png`, and `image/webp`. The app and API also reject files larger than 5 MiB; the bucket limit is the storage-side enforcement.
4. In **Project Settings → API Keys** (or the API settings page for the dashboard version), copy the **service_role** secret. Store it only in Vercel's server environment. It bypasses Storage RLS, so the API authorization checks are a critical boundary. Never put this key in `.env`, a `VITE_` variable, GitHub, Firestore, a browser build, or the APK.
5. Do not add public bucket access or public Storage policies. The app never accesses the bucket directly with the anon key for reads. Uploads use one-object signed resumable upload tokens; reads and downloads use short-lived signed URLs minted after Firebase membership checks.

No Storage SQL policy is needed for these server-mediated operations: Vercel uses the service role after its own authorization checks. Do not create client policies that allow anonymous uploads or reads.

## Configure Vercel

In the existing Vercel project, open **Settings → Environment Variables** and add these values to Production and Preview as appropriate, then redeploy the project:

| Variable | Where to copy it from | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase **Project URL** | No; public URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon/public** API key | No; public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** API key | **Yes**; server only |
| `FIREBASE_PROJECT_ID` | Firebase Web app's project ID | No |
| `FIREBASE_WEB_API_KEY` | Firebase Web app's web API key | No; Firebase client key |

The Vercel Function reads `SUPABASE_URL` if you separately choose to define it, otherwise it uses `VITE_SUPABASE_URL`. Do not define `SUPABASE_SERVICE_ROLE_KEY` with a `VITE_` prefix. For local front-end builds, put only the two `VITE_SUPABASE_*` values and the normal Firebase client settings in the ignored `.env`; keep the service-role key out of local Vite builds. Local server-function tests may use an isolated Supabase project and a server-only environment variable.

The default Android API origin is `https://contri-app.vercel.app`. `VITE_RECEIPT_API_BASE_URL` is optional and should only point at a trusted deployment that has the same server environment configured.

## Authorization and stored data

- Upload is allowed only when the server-verified Firebase identity has verified email `tsmane8787@gmail.com`, its UID matches the trip's stored `createdBy`, and the expense exists. Client-supplied UID, email, path and ownership claims are ignored. The server chooses the random object path and issues a token with overwrite disabled.
- The bucket must enforce the 5 MB limit and MIME allowlist. The upload API checks the file type and declared size before issuing the token; the bucket is authoritative for the actual upload.
- Viewing requires the caller's current `memberIds` membership (or `createdBy`) under the existing Firestore rules, and the exact Supabase object metadata must be attached to that trip expense. The function returns 2-minute signed view and download URLs. Those URLs are bearer links while valid, so do not persist or share them.
- Deletion requires trip admin authorization and an attached Supabase receipt object. The client removes only that receipt's metadata key after the object deletion succeeds. The trip, expense financial fields, and other receipt entries are untouched.
- New metadata is stored in the existing expense `receiptFiles` map. Existing `receiptURL` fields are unchanged and continue to render. Existing ImageKit records under `receiptFiles` are retained untouched but this Supabase client does not generate ImageKit URLs for them; keep the ImageKit account/assets if they are still needed elsewhere.
- Supabase Free does not provide server-side image transformations. Contri preserves and serves the original image for both preview sizes; it does not claim an optimized WebP thumbnail. No lossy conversion is performed.

## Safe test procedure

Use a disposable Supabase project/bucket and Firebase Auth/Firestore Emulator data. Do not use production trips or receipts for setup tests.

1. Configure the disposable bucket as private with its size/MIME restrictions.
2. Set the environment variables above in a local Vercel Function environment. Do not include the service-role key in Vite variables.
3. Sign in as a verified test identity representing `tsmane8787@gmail.com`, create an emulator trip whose `createdBy` is that test UID, and attach a test expense.
4. Upload one JPEG, PNG and WebP. Confirm each appears in the private bucket and that the expense's existing `receiptFiles` map contains only provider, bucket, opaque path, safe display name, MIME, size and upload time. Confirm the object has no public URL access.
5. Sign in as a different trip member. Confirm the member endpoint returns temporary signed URLs and the file can be viewed/downloaded. Wait past the URL expiry and confirm the old URL no longer works; request a fresh one through Contri.
6. Test an outsider, an unverified identity, a non-owner uploader, a member attempting deletion, invalid Firebase token, wrong trip/expense, unsupported MIME and over-limit file. Each must be denied before storage access or rejected by the private bucket.
7. Confirm a legacy `receiptURL` still opens, and confirm no production Firestore rules or records were changed.

The repository test suite mocks Supabase Storage and uses Firebase Auth/Firestore Emulators for authorization checks. It does not make a live Supabase upload, validate dashboard settings, or prove device camera/gallery behavior. Do not enable production uploads until the private bucket and Vercel variables have been verified in the actual deployment.
