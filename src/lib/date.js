import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

export const toDateValue = (value) => {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate()
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }

  return null
}

export const formatDate = (value, pattern = 'PPP') => {
  const date = toDateValue(value)
  return date ? format(date, pattern) : '—'
}

export const formatShortDate = (value) => formatDate(value, 'dd MMM')

export const formatTimelineDate = (value) => formatDate(value, 'dd MMM')

export const timeAgo = (value) => {
  const date = toDateValue(value)

  if (!date) {
    return 'just now'
  }

  return formatDistanceToNow(date, { addSuffix: true })
}
