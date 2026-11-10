const menuToggle = document.querySelector('.menu-toggle')
const navigation = document.querySelector('#primary-navigation')
const releaseHistory = document.querySelector('#release-history-list')
const releaseState = document.querySelector('#release-state')
const apiUrl = 'https://api.github.com/repos/iamtejas23/Contri-app/releases?per_page=10'
const releasesUrl = 'https://github.com/iamtejas23/Contri-app/releases'

document.querySelector('#current-year').textContent = String(new Date().getFullYear())

const isTrustedGitHubUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname.endsWith('.githubusercontent.com'))
  } catch {
    return false
  }
}

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const checksumForApk = async (apk, checksumAsset) => {
  // GitHub's digest belongs to that specific asset. Prefer the APK asset's
  // digest; the checksum sidecar's digest would be the hash of the text file.
  if (typeof apk.digest === 'string' && /^sha256:[a-f\d]{64}$/i.test(apk.digest)) {
    return apk.digest.slice('sha256:'.length)
  }
  if (!checksumAsset || !isTrustedGitHubUrl(checksumAsset.browser_download_url)) return ''

  try {
    const response = await fetch(checksumAsset.browser_download_url, { headers: { Accept: 'text/plain' } })
    if (!response.ok) return ''
    const content = await response.text()
    return content.match(/\b[a-f\d]{64}\b/i)?.[0]?.toLowerCase() || ''
  } catch {
    // A checksum download link remains available even when cross-origin reads are blocked.
    return ''
  }
}

const replaceWithDownloadLink = (apkUrl, version, filename) => {
  if (!isTrustedGitHubUrl(apkUrl)) return
  const oldButton = document.querySelector('#apk-download')
  const link = document.createElement('a')
  link.id = 'apk-download'
  link.className = 'button button-primary'
  link.href = apkUrl
  link.textContent = 'Download Android APK'
  link.setAttribute('aria-label', `Download Contri ${version} Android APK, ${filename}`)
  link.rel = 'nofollow noopener'
  oldButton.replaceWith(link)
}

const renderRelease = async (release, configuredAssets = {}) => {
  const version = release.tag_name || release.name || 'Android release'
  const expectedName = (configuredAssets.apk || `Contri-${version}.apk`).toLowerCase()
  const apk = release.assets?.find((asset) => asset.name.toLowerCase() === expectedName)
  if (!apk || !isTrustedGitHubUrl(apk.browser_download_url)) return false

  const checksumName = configuredAssets.checksum?.toLowerCase()
  const checksum = (checksumName && release.assets?.find((asset) => asset.name.toLowerCase() === checksumName))
    || release.assets?.find((asset) => asset.name.toLowerCase() === `${apk.name}.sha256`.toLowerCase())
    || release.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk.sha256'))
  const date = formatDate(release.published_at)

  replaceWithDownloadLink(apk.browser_download_url, version, apk.name)
  document.querySelector('#download-title').setAttribute('aria-label', `Download Contri ${version}`)
  document.querySelector('#download-description').textContent = `Download ${apk.name} for Android from the official Contri ${version} GitHub Release.`
  document.querySelector('#release-details').hidden = false
  document.querySelector('#release-version').textContent = version
  document.querySelector('#release-size').textContent = formatBytes(apk.size)
  document.querySelector('#release-date').textContent = date
  document.querySelector('#release-panel-version').textContent = version
  document.querySelector('#release-panel-description').textContent = `${apk.name} · ${formatBytes(apk.size)} · Published ${date}.`
  document.querySelector('.release-panel-label').textContent = 'OFFICIAL ANDROID RELEASE'
  releaseState.textContent = 'APK available'

  if (checksum && isTrustedGitHubUrl(checksum.browser_download_url)) {
    document.querySelector('#checksum-download').href = checksum.browser_download_url
    const hash = await checksumForApk(apk, checksum)
    if (hash) {
      document.querySelector('#release-checksum').textContent = hash
      document.querySelector('#checksum-row').hidden = false
    } else {
      document.querySelector('#release-checksum').textContent = 'Open attached checksum file'
      document.querySelector('#checksum-row').hidden = false
    }
  }
  return true
}

const renderHistory = (releases) => {
  releaseHistory.replaceChildren()
  const stableReleases = releases.filter((release) => !release.draft && !release.prerelease)
  if (!stableReleases.length) {
    const empty = document.createElement('p')
    empty.className = 'history-empty'
    empty.textContent = 'No stable Android releases have been published yet.'
    releaseHistory.append(empty)
    return
  }

  stableReleases.slice(0, 5).forEach((release) => {
    const row = document.createElement('article')
    row.className = 'history-row'
    const copy = document.createElement('div')
    copy.className = 'history-row-main'
    const title = document.createElement('strong')
    title.textContent = release.tag_name || release.name || 'Contri release'
    const date = document.createElement('small')
    const config = window.CONTRI_SITE_CONFIG || {}
    const isConfiguredRelease = release.tag_name === config.version
    const expectedApkName = (isConfiguredRelease ? config.apk : `Contri-${release.tag_name}.apk`).toLowerCase()
    const apk = release.assets?.find((asset) => asset.name.toLowerCase() === expectedApkName)
      || release.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'))
    date.textContent = apk
      ? `${formatDate(release.published_at)} · ${formatBytes(apk.size)} · ${apk.name}`
      : `${formatDate(release.published_at)} · No APK asset attached`
    copy.append(title, date)
    const link = document.createElement('a')
    link.href = isTrustedGitHubUrl(release.html_url) ? release.html_url : releasesUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'Release details ↗'
    row.append(copy, link)
    releaseHistory.append(row)
  })
}

const loadReleaseData = async () => {
  try {
    const response = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) throw new Error('GitHub release lookup failed')
    const releases = await response.json()
    renderHistory(Array.isArray(releases) ? releases : [])

    const config = window.CONTRI_SITE_CONFIG || {}
    const configuredRelease = releases.find((release) => release.tag_name === config.version && !release.draft && !release.prerelease)
    if (configuredRelease && config.apk && await renderRelease(configuredRelease, config)) return

    const latestStable = releases.find((release) => !release.draft && !release.prerelease && release.assets?.some((asset) => asset.name.toLowerCase() === `contri-${release.tag_name}.apk`.toLowerCase()))
    if (latestStable && await renderRelease(latestStable)) return
    const newestStable = releases.find((release) => !release.draft && !release.prerelease)
    const newestApk = newestStable?.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'))
    if (newestStable && newestApk) {
      document.querySelector('#download-description').textContent = `GitHub release ${newestStable.tag_name} currently contains ${newestApk.name}. Contri only offers the signed, versioned APK asset as a stable download.`
      document.querySelector('#release-panel-version').textContent = newestStable.tag_name
      document.querySelector('#release-panel-description').textContent = `Expected stable asset: Contri-${newestStable.tag_name}.apk. The current ${newestApk.name} is not offered as a stable download.`
      document.querySelector('.release-panel-label').textContent = 'GITHUB RELEASE · NO STABLE APK'
      releaseState.textContent = 'Stable APK missing'
      return
    }
    document.querySelector('#download-description').textContent = 'The Android download will be available here after the first stable APK is published.'
    document.querySelector('#release-panel-description').textContent = 'No stable APK release is available yet. This panel will show the version, file size, date, and checksum when one is published.'
    document.querySelector('.release-panel-label').textContent = 'LATEST STABLE APK'
    releaseState.textContent = 'Coming soon'
  } catch {
    document.querySelector('#download-description').textContent = 'Check the official GitHub Releases page for current Android APK availability.'
    document.querySelector('#release-panel-description').textContent = 'Release details are temporarily unavailable. Visit GitHub Releases for the current status.'
    document.querySelector('.release-panel-label').textContent = 'ANDROID RELEASE STATUS'
    releaseState.textContent = 'Release status unavailable'
  }
}

const closeMenu = () => {
  menuToggle.setAttribute('aria-expanded', 'false')
  menuToggle.setAttribute('aria-label', 'Open navigation menu')
  navigation.classList.remove('is-open')
}

menuToggle.addEventListener('click', () => {
  const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true'
  menuToggle.setAttribute('aria-expanded', String(!isExpanded))
  menuToggle.setAttribute('aria-label', isExpanded ? 'Open navigation menu' : 'Close navigation menu')
  navigation.classList.toggle('is-open', !isExpanded)
})

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu()
    menuToggle.focus()
  }
})

window.addEventListener('resize', () => {
  if (window.innerWidth > 760) closeMenu()
})

const navLinks = [...navigation.querySelectorAll('a[href^="#"]')]
const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean)
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      })
    })
  }, { rootMargin: '-25% 0px -65% 0px' })
  sections.forEach((section) => observer.observe(section))
}

loadReleaseData()
