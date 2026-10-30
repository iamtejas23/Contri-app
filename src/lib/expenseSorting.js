const timestampToMillis = (value) => {
  if (value == null) return null

  let date = null
  if (value instanceof Date) date = value
  else if (typeof value?.toDate === 'function') {
    try {
      date = value.toDate()
    } catch {
      return null
    }
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e11 ? value * 1000 : value
  } else if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  } else if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0
    if (Number.isFinite(seconds)) return seconds * 1000 + nanoseconds / 1e6
  }

  return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null
}

export const expenseCreationTime = (expense, creationActivityMap = {}) =>
  timestampToMillis(expense?.createdAt) ?? timestampToMillis(creationActivityMap[expense?.id]?.timestamp)

/** Newest creation time first; records without a usable creation time remain at the end. */
export const sortExpensesNewestFirst = (expenses = [], creationActivityMap = {}) =>
  [...expenses].sort((first, second) => {
    const firstTime = expenseCreationTime(first, creationActivityMap)
    const secondTime = expenseCreationTime(second, creationActivityMap)

    if (firstTime != null && secondTime == null) return -1
    if (firstTime == null && secondTime != null) return 1
    if (firstTime != null && secondTime != null && firstTime !== secondTime) return secondTime - firstTime
    return String(first.id || '').localeCompare(String(second.id || ''))
  })
