import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

type DateLike = string | Date | { toDate?: () => Date } | null | undefined

export const toDateValue = (value: DateLike) => {
  if (!value) return null

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  if (value instanceof Date) return value

  if (typeof value === 'string') {
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }

  return null
}

export const formatDate = (value: DateLike, pattern = 'PPP') => {
  const date = toDateValue(value)
  return date ? format(date, pattern) : '—'
}

export const formatShortDate = (value: DateLike) => formatDate(value, 'dd MMM')

export const formatTimelineDate = (value: DateLike) => formatDate(value, 'dd MMM')

export const isDateBefore = (value?: string | null, comparison?: string | null) =>
  Boolean(value && comparison && value < comparison)

export const isDateAfter = (value?: string | null, comparison?: string | null) =>
  Boolean(value && comparison && value > comparison)

export const isDateOutsideRange = (
  value?: string | null,
  { min, max }: { min?: string | null; max?: string | null } = {},
) => isDateBefore(value, min) || isDateAfter(value, max)

export const timeAgo = (value: DateLike) => {
  const date = toDateValue(value)
  if (!date) return 'just now'
  return formatDistanceToNow(date, { addSuffix: true })
}
