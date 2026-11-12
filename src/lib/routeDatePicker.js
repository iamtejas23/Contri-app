export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export const toDateOnly = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const getMonthCalendar = (year, month) => {
  const firstDay = new Date(year, month, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const dayCount = new Date(year, month + 1, 0).getDate()
  return [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => toDateOnly(new Date(year, month, index + 1))),
  ]
}

export const shiftCalendarMonth = ({ year, month }, amount) => {
  const shifted = new Date(year, month + amount, 1)
  return { year: shifted.getFullYear(), month: shifted.getMonth() }
}
