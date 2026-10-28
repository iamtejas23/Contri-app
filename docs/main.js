const siteConfig = window.CONTRI_SITE_CONFIG || {}
const apkUrl = typeof siteConfig.APK_URL === 'string' ? siteConfig.APK_URL.trim() : ''
const menuToggle = document.querySelector('.menu-toggle')
const navigation = document.querySelector('#primary-navigation')
const downloadAction = document.querySelector('#download-action')
const releaseMeta = document.querySelector('#release-meta')

document.querySelector('#current-year').textContent = String(new Date().getFullYear())

const isDirectApkUrl =
  /^https:\/\/\S+\.apk(?:[?#]\S*)?$/i.test(apkUrl) ||
  /^\.\.?\/\S+\.apk(?:[?#]\S*)?$/i.test(apkUrl)

if (isDirectApkUrl) {
  const downloadLink = document.createElement('a')
  downloadLink.className = 'button button-primary'
  downloadLink.href = apkUrl
  downloadLink.textContent = 'Download Android APK'
  downloadLink.setAttribute('aria-label', 'Download the Contri Android APK')
  downloadLink.rel = 'nofollow'
  downloadAction.querySelector('button').replaceWith(downloadLink)

  const details = [siteConfig.VERSION, siteConfig.RELEASE_DATE].filter(Boolean)
  releaseMeta.textContent = details.length ? details.join(' · ') : 'Android APK available'
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
