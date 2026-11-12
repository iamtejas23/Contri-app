import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonthCalendar, parseDateOnly, shiftCalendarMonth, toDateOnly, WEEKDAY_LABELS } from '../../lib/routeDatePicker.js'

const today = () => toDateOnly(new Date())
const monthTitle = (year, month) => new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
const dateLabel = (value) => {
  const date = parseDateOnly(value)
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Choose a date'
}

export const DateField = ({ label, value = '', onChange, maxDate = '', required = false }) => {
  const selectedDate = parseDateOnly(value)
  const initial = selectedDate || parseDateOnly(today())
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => ({ year: initial.getFullYear(), month: initial.getMonth() }))

  const days = getMonthCalendar(visibleMonth.year, visibleMonth.month)
  const max = parseDateOnly(maxDate)
  const selectedLabel = value ? dateLabel(value) : 'Choose a date'

  return (
    <div className="route-date-field min-w-0 max-w-full">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <button
        aria-expanded={open}
        aria-haspopup="grid"
        aria-label={`${label}: ${selectedLabel}`}
        className="route-date-trigger"
        onClick={() => {
          if (!open) {
            const date = parseDateOnly(value) || parseDateOnly(today())
            setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() })
          }
          setOpen((current) => !current)
        }}
        type="button"
      >
        <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-dusk" />
        <span className={value ? 'truncate text-ink' : 'truncate text-dusk'}>{selectedLabel}</span>
      </button>
      {open ? (
        <div aria-label={`${label} calendar`} className="route-date-calendar" role="group">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <button aria-label="Previous month" className="route-date-nav" onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, -1))} type="button"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
            <span aria-live="polite" className="min-w-0 flex-1 text-center text-sm font-semibold text-ink">{monthTitle(visibleMonth.year, visibleMonth.month)}</span>
            <button aria-label="Next month" className="route-date-nav" onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, 1))} type="button"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          <div aria-hidden="true" className="route-date-grid route-date-weekdays">
            {WEEKDAY_LABELS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div aria-label={monthTitle(visibleMonth.year, visibleMonth.month)} className="route-date-grid" role="grid">
            {days.map((day, index) => {
              if (!day) return <span aria-hidden="true" className="route-date-empty" key={`empty-${index}`} />
              const isDisabled = Boolean(max && day > toDateOnly(max))
              const isSelected = day === value
              return <button
                aria-label={parseDateOnly(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                aria-selected={isSelected}
                className={`route-date-day${isSelected ? ' route-date-day--selected' : ''}`}
                disabled={isDisabled}
                key={day}
                onClick={() => { onChange(day); setOpen(false) }}
                role="gridcell"
                type="button"
              >{Number(day.slice(-2))}</button>
            })}
          </div>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-slate-200 pt-2 dark:border-white/10">
            <button className="route-date-text-action" disabled={!value || required} onClick={() => { onChange(''); setOpen(false) }} type="button">Clear date</button>
            <button className="route-date-text-action" onClick={() => { onChange(today()); setOpen(false) }} type="button">Today</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
