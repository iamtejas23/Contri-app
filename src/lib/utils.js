import clsx from 'clsx'

export const cn = (...inputs) => clsx(inputs)

export const roundCurrency = (value) => Number(Number(value || 0).toFixed(2))

export const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getInitials = (value, fallback = 'CG') => {
  if (!value) {
    return fallback
  }

  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) {
    return fallback
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

export const getDisplayName = (entity) => {
  if (!entity) {
    return 'Traveler'
  }

  return entity.name || entity.displayName || entity.email?.split('@')[0] || 'Traveler'
}

export const buildMemberFromIdentity = (identity, role = 'member') => ({
  uid: identity.uid,
  name: getDisplayName(identity),
  email: identity.email || '',
  role,
})

export const sanitizeFileName = (name = 'receipt') =>
  name.replace(/[^\w.-]+/g, '-').toLowerCase()

export const uniqueBy = (items, selector) => {
  const seen = new Set()

  return items.filter((item) => {
    const key = selector(item)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export const copyToClipboard = async (text) => {
  if (!navigator?.clipboard) {
    throw new Error('Clipboard access is not available in this browser.')
  }

  await navigator.clipboard.writeText(text)
}
