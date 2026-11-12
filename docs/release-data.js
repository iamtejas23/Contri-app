export const RELEASES_API_URL = 'https://api.github.com/repos/iamtejas23/Contri-app/releases'
export const LATEST_RELEASE_API_URL = `${RELEASES_API_URL}/latest`
export const RELEASES_PAGE_URL = 'https://github.com/iamtejas23/Contri-app/releases'

export const isTrustedGitHubUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && (url.hostname === 'github.com' || url.hostname === 'githubusercontent.com' || url.hostname.endsWith('.githubusercontent.com'))
  } catch {
    return false
  }
}

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

export const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const isStableRelease = (release) => Boolean(
  release && typeof release === 'object' && !release.draft && !release.prerelease,
)

export const latestStableRelease = (releases) => (
  Array.isArray(releases)
    ? releases.filter(isStableRelease).sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0))[0] || null
    : null
)

export const validateLatestRelease = (release) => {
  if (!isStableRelease(release)
    || typeof release.tag_name !== 'string'
    || !release.tag_name.trim()
    || !Array.isArray(release.assets)
    || !Number.isFinite(new Date(release.published_at).getTime())) {
    throw new Error('GitHub returned invalid release metadata.')
  }
  return release
}

export const selectApkAsset = (release) => {
  if (!Array.isArray(release?.assets)) return null
  const candidates = release.assets.filter((asset) => (
    typeof asset?.name === 'string'
    && asset.name.toLowerCase().endsWith('.apk')
    && Number.isFinite(asset.size)
    && asset.size > 0
    && isTrustedGitHubUrl(asset.browser_download_url)
  ))
  if (!candidates.length) return null

  const tag = release.tag_name.toLowerCase()
  return candidates.find((asset) => asset.name.toLowerCase() === `contri-app-${tag}.apk`)
    || candidates.find((asset) => /(?:universal|release)/i.test(asset.name) && !/debug/i.test(asset.name))
    || candidates.find((asset) => asset.name.toLowerCase().includes(tag) && !/debug/i.test(asset.name))
    || candidates.find((asset) => !/debug/i.test(asset.name) && candidates.length === 1)
    || (candidates.length === 1 ? candidates[0] : null)
}

export const selectChecksumAsset = (release, apk) => {
  if (!Array.isArray(release?.assets) || !apk) return null
  const candidates = release.assets.filter((asset) => (
    typeof asset?.name === 'string'
    && /(?:sha-?256|checksum)/i.test(asset.name)
    && isTrustedGitHubUrl(asset.browser_download_url)
  ))
  const tag = release.tag_name.toLowerCase()
  return candidates.find((asset) => asset.name.toLowerCase().includes(tag))
    || candidates.find((asset) => asset.name.toLowerCase().includes(apk.name.toLowerCase()))
    || candidates[0]
    || null
}

export const checksumFromDigest = (digest) => (
  typeof digest === 'string' && /^sha256:[a-f\d]{64}$/i.test(digest)
    ? digest.slice('sha256:'.length).toLowerCase()
    : ''
)

export const checksumFromSidecar = (content, apkName = '') => {
  if (typeof content !== 'string') return ''
  const lines = content.split(/\r?\n/).filter(Boolean)
  const apkLine = lines.find((line) => apkName && line.toLowerCase().includes(apkName.toLowerCase()))
  const hash = (apkLine || lines[0] || '').match(/\b[a-f\d]{64}\b/i)?.[0]
  return hash?.toLowerCase() || ''
}

export const fetchJson = async (url, fetchImpl = fetch) => {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    const error = new Error(`GitHub release request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return response.json()
}
