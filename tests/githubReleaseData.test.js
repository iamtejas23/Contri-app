import assert from 'node:assert/strict'
import test from 'node:test'

import {
  checksumFromDigest,
  checksumFromSidecar,
  fetchJson,
  formatBytes,
  isTrustedGitHubUrl,
  latestStableRelease,
  selectApkAsset,
  selectChecksumAsset,
  validateLatestRelease,
} from '../docs/release-data.js'

const apkAsset = (name = 'app-debug.apk') => ({
  name,
  size: 12_694_449,
  browser_download_url: `https://github.com/iamtejas23/Contri-app/releases/download/tag/${name}`,
  digest: `sha256:${'a'.repeat(64)}`,
})

const release = (tag, published, options = {}) => ({
  tag_name: tag,
  name: `Contri ${tag}`,
  published_at: published,
  draft: false,
  prerelease: false,
  html_url: `https://github.com/iamtejas23/Contri-app/releases/tag/${tag}`,
  assets: [apkAsset(options.apkName), ...(options.checksum ? [{
    name: `contri-${tag}-sha256.txt`,
    size: 88,
    browser_download_url: `https://github.com/iamtejas23/Contri-app/releases/download/${tag}/contri-${tag}-sha256.txt`,
  }] : [])],
})

test('latest stable selection ignores drafts and prereleases and sorts by published date', () => {
  const older = release('v1.0.0', '2026-11-10T09:00:00Z')
  const newer = release('v1.0.1', '2026-11-12T03:00:00Z')
  const draft = { ...release('v1.0.2', '2026-11-13T03:00:00Z'), draft: true }
  const preview = { ...release('v2.0.0-rc.1', '2026-11-14T03:00:00Z'), prerelease: true }
  assert.equal(latestStableRelease([older, preview, draft, newer]), newer)
})

test('latest release response must be stable and contain valid metadata', () => {
  const stable = release('v1.0.1', '2026-11-12T03:00:00Z')
  assert.equal(validateLatestRelease(stable), stable)
  assert.throws(() => validateLatestRelease({ ...stable, prerelease: true }), /invalid release metadata/)
  assert.throws(() => validateLatestRelease({ ...stable, published_at: 'unknown' }), /invalid release metadata/)
})

test('APK selection accepts the single APK asset even if its name is generic', () => {
  const current = release('v1.0.1', '2026-11-12T03:00:00Z', { apkName: 'app-debug.apk' })
  assert.equal(selectApkAsset(current).name, 'app-debug.apk')
  assert.equal(selectApkAsset(release('v1.0.2', '2026-11-13T03:00:00Z', { apkName: 'contri-app-v1.0.2.apk' })).name, 'contri-app-v1.0.2.apk')
})

test('ambiguous, zero-size and untrusted APK assets are not offered for download', () => {
  const multiple = release('v1.0.1', '2026-11-12T03:00:00Z')
  multiple.assets.push(apkAsset('other.apk'))
  assert.equal(selectApkAsset(multiple), null)
  multiple.assets[1].browser_download_url = 'http://example.com/other.apk'
  assert.equal(selectApkAsset(multiple).name, 'app-debug.apk')
  const empty = release('v1.0.1', '2026-11-12T03:00:00Z')
  empty.assets[0].size = 0
  assert.equal(selectApkAsset(empty), null)
})

test('checksum sidecar is matched to release tag and uses the APK digest when available', () => {
  const current = release('v1.0.1', '2026-11-12T03:00:00Z', { checksum: true })
  const apk = selectApkAsset(current)
  assert.equal(selectChecksumAsset(current, apk).name, 'contri-v1.0.1-sha256.txt')
  assert.equal(checksumFromDigest(apk.digest), 'a'.repeat(64))
  assert.equal(checksumFromSidecar(`${'b'.repeat(64)}  other.apk\n${'c'.repeat(64)}  app-debug.apk`, apk.name), 'c'.repeat(64))
})

test('GitHub asset URLs are constrained and download sizes use binary units', () => {
  assert.equal(isTrustedGitHubUrl('https://github.com/owner/repo/releases/file.apk'), true)
  assert.equal(isTrustedGitHubUrl('https://evilgithub.com/file.apk'), false)
  assert.equal(isTrustedGitHubUrl('javascript:alert(1)'), false)
  assert.equal(formatBytes(12_694_449), '12.11 MiB')
})

test('release API helper validates HTTP status and sends GitHub JSON accept header', async () => {
  let request
  const payload = { tag_name: 'v1.0.1' }
  const result = await fetchJson('https://api.github.com/test', async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => payload }
  })
  assert.equal(result, payload)
  assert.equal(request.options.headers.Accept, 'application/vnd.github+json')
  await assert.rejects(fetchJson('https://api.github.com/test', async () => ({ ok: false, status: 403 })), /failed \(403\)/)
})
