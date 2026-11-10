# Android push notification presentation

Contri uses the existing authenticated Vercel dispatch endpoint and Firebase Cloud Messaging. The Android app creates two stable channel IDs:

- `contri_updates_v2`: Android's standard notification sound.
- `contri_updates_silent_v2`: silent alerts.

The saved Sound On/Off preference is copied to the registered device token. The dispatch API chooses the channel for each device. A missing preference defaults to silent. The app leaves the old `contri_updates` channel in place because Android channel settings belong to the user and cannot be changed by an app update.

Android retains channel choices made by users. After updating, a user who previously changed Contri's notification channel may need to open **Android Settings → Apps → Contri → Notifications** and adjust the new Trip updates channel. The app does not create new channel IDs per launch.

The small status-bar icon uses the monochrome `ic_stat_contri` drawable. Firebase Admin's Android notification payload supports a small icon and an image URL, but has no separate large-icon resource field. An image URL becomes expanded image content rather than the compact large icon, so Contri does not misrepresent the logo that way.

## Deployment notes

No production deployment or rule deployment was performed. The Vercel API source must be deployed for event-specific message text and per-device channel selection. Firestore rules in this repository allow the optional boolean `soundEnabled` token field. The client retries token registration with the previous field set when production rules have not yet been updated, so push registration can continue silently. To enable per-device sound selection, review and deploy the rules change separately; until then, devices without the field receive silent pushes.

Foreground Android FCM alerts are displayed by the existing Capacitor Push Notifications plugin using `presentationOptions: ["alert"]` and the FCM-selected Android channel. No custom audio file or sound override is included.
