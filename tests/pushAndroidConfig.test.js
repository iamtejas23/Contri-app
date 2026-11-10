import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('Android manifest and Capacitor use wallet status icon and the versioned default channel', async () => {
  const [manifest, icon, service, config] = await Promise.all([
    readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/res/drawable/ic_stat_contri.xml', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/pushNotifications.js', import.meta.url), 'utf8'),
    readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'),
  ])
  assert.match(manifest, /default_notification_icon" android:resource="@drawable\/ic_stat_contri"/)
  assert.match(manifest, /default_notification_channel_id" android:value="contri_updates_v2"/)
  assert.match(icon, /android:fillColor="#FFFFFFFF"/)
  assert.match(icon, /android:pathData="[^"]*(?:M|m)4,6\.25/)
  assert.match(service, /audible: 'contri_updates_v2', silent: 'contri_updates_silent_v2'/)
  assert.match(config, /"presentationOptions": \["alert"\]/)
})

test('Android alert payload relies on OS channels and no custom sound asset is bundled', async () => {
  const [dispatch, service, coinAsset] = await Promise.all([
    readFile(new URL('../api/_lib/pushDispatch.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/pushNotifications.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/assets/notification-coin.wav', import.meta.url)).then(() => true, () => false),
  ])
  assert.match(dispatch, /channelId: getPushChannelForPreference\(group\.soundEnabled\)/)
  assert.match(dispatch, /icon: 'ic_stat_contri'/)
  assert.doesNotMatch(dispatch, /sound\s*:/)
  assert.doesNotMatch(service, /sound\s*:/)
  assert.equal(coinAsset, false)
})
