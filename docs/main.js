import {
  checksumFromDigest,
  checksumFromSidecar,
  fetchJson,
  formatBytes,
  formatDate,
  isStableRelease,
  isTrustedGitHubUrl,
  LATEST_RELEASE_API_URL,
  RELEASES_API_URL,
  RELEASES_PAGE_URL,
  selectApkAsset,
  selectChecksumAsset,
  validateLatestRelease,
} from './release-data.js'

const menuToggle = document.querySelector('.menu-toggle')
const navigation = document.querySelector('#primary-navigation')
const releaseHistory = document.querySelector('#release-history-list')
const releaseState = document.querySelector('#release-state')

document.querySelector('#current-year').textContent = String(new Date().getFullYear())

const setUnavailable = (message, state = 'Release status unavailable') => {
  document.querySelector('#download-description').textContent = message
  document.querySelector('#release-panel-description').textContent = message
  document.querySelector('.release-panel-label').textContent = 'ANDROID RELEASE STATUS'
  releaseState.textContent = state
  const download = document.querySelector('#apk-download')
  download.textContent = 'Android APK · Unavailable'
  download.disabled = true
  document.querySelector('#release-details').hidden = true
  document.querySelector('#checksum-row').hidden = true
  document.querySelector('#release-notes-wrap').hidden = true
}

const replaceWithDownloadLink = (apk, version) => {
  const oldButton = document.querySelector('#apk-download')
  const link = document.createElement('a')
  link.id = 'apk-download'
  link.className = 'button button-primary'
  link.href = apk.browser_download_url
  link.textContent = 'Download Android APK'
  link.setAttribute('aria-label', `Download Contri ${version} Android APK, ${apk.name}`)
  link.rel = 'nofollow noopener'
  oldButton.replaceWith(link)
}

const getChecksum = async (apk, checksumAsset) => {
  const digest = checksumFromDigest(apk.digest)
  if (digest) return digest
  if (!checksumAsset) return ''
  try {
    const response = await fetch(checksumAsset.browser_download_url, { headers: { Accept: 'text/plain' } })
    if (!response.ok) return ''
    return checksumFromSidecar(await response.text(), apk.name)
  } catch {
    return ''
  }
}

const renderRelease = async (release) => {
  const version = release.tag_name
  const apk = selectApkAsset(release)
  if (!apk) {
    setUnavailable(`The latest stable release (${version}) does not contain a valid APK asset yet.`, 'APK not attached')
    document.querySelector('#release-panel-version').textContent = version
    document.querySelector('.release-panel-label').textContent = 'LATEST STABLE RELEASE · APK MISSING'
    document.querySelector('#release-panel-link').href = isTrustedGitHubUrl(release.html_url) ? release.html_url : RELEASES_PAGE_URL
    document.querySelector('#release-details').hidden = false
    document.querySelector('#release-version').textContent = version
    document.querySelector('#release-size').textContent = 'No APK attached'
    document.querySelector('#release-date').textContent = formatDate(release.published_at)
    const notes = typeof release.body === 'string' ? release.body.trim() : ''
    document.querySelector('#release-notes').textContent = notes || 'No release notes were provided.'
    document.querySelector('#release-notes-wrap').hidden = false
    return
  }

  const checksumAsset = selectChecksumAsset(release, apk)
  const date = formatDate(release.published_at)
  replaceWithDownloadLink(apk, version)
  document.querySelector('#download-title').setAttribute('aria-label', `Download Contri ${version}`)
  document.querySelector('#download-description').textContent = `Download ${apk.name} for Android from the latest stable Contri release.`
  document.querySelector('#release-details').hidden = false
  document.querySelector('#release-version').textContent = version
  document.querySelector('#release-size').textContent = formatBytes(apk.size)
  document.querySelector('#release-date').textContent = date
  document.querySelector('#release-panel-version').textContent = version
  document.querySelector('#release-panel-description').textContent = `${apk.name} · ${formatBytes(apk.size)} · Published ${date}.`
  document.querySelector('.release-panel-label').textContent = 'LATEST STABLE ANDROID RELEASE'
  document.querySelector('#release-panel-link').href = isTrustedGitHubUrl(release.html_url) ? release.html_url : RELEASES_PAGE_URL
  releaseState.textContent = 'APK available'

  const notesWrap = document.querySelector('#release-notes-wrap')
  const notes = typeof release.body === 'string' ? release.body.trim() : ''
  document.querySelector('#release-notes').textContent = notes || 'No release notes were provided.'
  notesWrap.hidden = false

  const checksumRow = document.querySelector('#checksum-row')
  const hash = await getChecksum(apk, checksumAsset)
  const checksumCode = document.querySelector('#release-checksum')
  const copyButton = document.querySelector('#copy-checksum')
  const checksumLink = document.querySelector('#checksum-download')
  if (hash) {
    checksumCode.textContent = hash
    copyButton.disabled = false
    copyButton.hidden = false
    checksumRow.hidden = false
  } else if (checksumAsset) {
    checksumCode.textContent = 'Open the checksum file to verify this APK.'
    copyButton.disabled = true
    copyButton.hidden = true
    checksumRow.hidden = false
  } else {
    checksumRow.hidden = true
  }
  if (checksumAsset) {
    checksumLink.href = checksumAsset.browser_download_url
    checksumLink.hidden = false
  } else {
    checksumLink.hidden = true
  }
}

const renderHistory = (releases) => {
  releaseHistory.replaceChildren()
  const stableReleases = releases
    .filter(isStableRelease)
    .sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0))

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
    const apk = selectApkAsset(release)
    date.textContent = apk
      ? `${formatDate(release.published_at)} · ${formatBytes(apk.size)} · ${apk.name}`
      : `${formatDate(release.published_at)} · No APK asset attached`
    copy.append(title, date)
    const link = document.createElement('a')
    link.href = isTrustedGitHubUrl(release.html_url) ? release.html_url : RELEASES_PAGE_URL
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'Release details ↗'
    row.append(copy, link)
    releaseHistory.append(row)
  })
}

const loadReleaseData = async () => {
  const [latestResult, historyResult] = await Promise.allSettled([
    fetchJson(LATEST_RELEASE_API_URL).then(validateLatestRelease),
    fetchJson(`${RELEASES_API_URL}?per_page=20`),
  ])

  if (historyResult.status === 'fulfilled' && Array.isArray(historyResult.value)) {
    renderHistory(historyResult.value)
  } else {
    const error = document.createElement('p')
    error.className = 'history-empty'
    error.textContent = 'Release history is temporarily unavailable. Open GitHub Releases to see all versions.'
    releaseHistory.replaceChildren(error)
  }

  if (latestResult.status === 'fulfilled') {
    await renderRelease(latestResult.value)
    return
  }

  if (latestResult.reason?.status === 404) {
    setUnavailable('No stable Android release has been published yet. Check back here after the first APK release.', 'Coming soon')
  } else {
    setUnavailable('Release information could not be loaded right now. Visit the official GitHub Releases page for the latest APK.', 'Release status unavailable')
  }
}

const copyChecksum = async () => {
  const value = document.querySelector('#release-checksum').textContent.trim()
  if (!/^[a-f\d]{64}$/i.test(value)) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const input = document.createElement('textarea')
      input.value = value
      input.setAttribute('readonly', '')
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.append(input)
      input.select()
      const copied = document.execCommand('copy')
      input.remove()
      if (!copied) throw new Error('Clipboard unavailable')
    }
    const button = document.querySelector('#copy-checksum')
    const status = document.querySelector('#copy-checksum-status')
    button.textContent = 'Copied'
    status.textContent = 'SHA-256 checksum copied.'
    window.setTimeout(() => { button.textContent = 'Copy' }, 1800)
  } catch {
    document.querySelector('#copy-checksum-status').textContent = 'Could not copy the checksum. Select and copy it manually.'
  }
}

document.querySelector('#copy-checksum').addEventListener('click', copyChecksum)

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
