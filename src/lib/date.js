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

export const sortRecordsByDate = (records = [], fields = []) =>
  [...records].sort((first, second) => {
    const getTime = (record) => {
      for (const field of fields) {
        const date = toDateValue(record[field])
        if (date) return date.getTime()
      }
      return 0
    }

    const dateDifference = getTime(second) - getTime(first)
    return dateDifference || String(first.id || '').localeCompare(String(second.id || ''))
  })

export const formatDate = (value, pattern = 'PPP') => {
  const date = toDateValue(value)
  return date ? format(date, pattern) : '—'
}

export const formatShortDate = (value) => formatDate(value, 'dd MMM')

export const formatTimelineDate = (value) => formatDate(value, 'dd MMM')

export const isDateBefore = (value, comparison) =>
  Boolean(value && comparison && value < comparison)

export const isDateAfter = (value, comparison) =>
  Boolean(value && comparison && value > comparison)

export const isDateOutsideRange = (value, { min, max } = {}) =>
  isDateBefore(value, min) || isDateAfter(value, max)

export const timeAgo = (value) => {
  const date = toDateValue(value)

  if (!date) {
    return 'just now'
  }

  return formatDistanceToNow(date, { addSuffix: true })
}
