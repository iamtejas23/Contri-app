import type { Actor, MemberRole, TripMember } from '../types'

export const roundCurrency = (value: unknown) => Number(Number(value || 0).toFixed(2))

export const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getInitials = (value?: string | null, fallback = 'CG') => {
  if (!value) return fallback

  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return fallback

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

export const getDisplayName = (entity?: {
  name?: string | null
  displayName?: string | null
  email?: string | null
} | null) => {
  if (!entity) return 'Traveler'
  return entity.name || entity.displayName || entity.email?.split('@')[0] || 'Traveler'
}

export const buildMemberFromIdentity = (
  identity: {
    uid: string
    name?: string
    displayName?: string
    email?: string
    upiId?: string
  },
  role: MemberRole = 'member',
): TripMember => ({
  uid: identity.uid,
  name: getDisplayName(identity),
  email: identity.email || '',
  role,
  upiId: identity.upiId || '',
})

export const buildActor = (
  user?: { uid?: string; email?: string | null; displayName?: string | null } | null,
  profile?: { name?: string; email?: string; upiId?: string } | null,
): Actor => ({
  uid: user?.uid || '',
  name: getDisplayName(profile || user),
  email: profile?.email || user?.email || '',
  upiId: profile?.upiId || '',
})

export const sanitizeFileName = (name = 'receipt') =>
  name.replace(/[^\w.-]+/g, '-').toLowerCase()

export const isValidUrl = (value?: string) => {
  if (!value) return true
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export const uniqueBy = <T>(items: T[], selector: (item: T) => string) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = selector(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
