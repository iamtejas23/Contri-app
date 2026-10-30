import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addMonths, endOfMonth, format, isValid, parse, startOfMonth, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const parseDate = (value) => {
  if (!value) return null
  const date = typeof value === 'string' ? parse(value, 'yyyy-MM-dd', new Date()) : new Date(value)
  return isValid(date) ? date : null
}
const toISO = (date) => format(date, 'yyyy-MM-dd')
const sameDay = (a, b) => Boolean(a && b && toISO(a) === toISO(b))

/** In-app date calendar: avoids inconsistent Android WebView native date dialogs. */
export const DatePicker = ({ label, hint, className, name, value, onChange, min, max, required, disabled, ...props }) => {
  const [open, setOpen] = useState(false)
  const initial = parseDate(value) || parseDate(min) || new Date()
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(initial))
  const [draft, setDraft] = useState(parseDate(value))
  const [chooser, setChooser] = useState('days')
  const minDate = parseDate(min)
  const maxDate = parseDate(max)
  const parsedValue = parseDate(value)
  const monthStart = startOfMonth(visibleMonth)
  const monthDays = endOfMonth(visibleMonth).getDate()
  const dayOffset = monthStart.getDay()
  const days = useMemo(() => Array.from({ length: Math.ceil((dayOffset + monthDays) / 7) * 7 }, (_, index) => {
    const day = index - dayOffset + 1
    return day > 0 && day <= monthDays ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null
  }), [dayOffset, monthDays, visibleMonth])
  const years = useMemo(() => Array.from({ length: 121 }, (_, i) => new Date().getFullYear() - 80 + i), [])

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keydown = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', keydown) }
  }, [open])

  const openPicker = () => {
    const selected = parseDate(value)
    setDraft(selected)
    setVisibleMonth(startOfMonth(selected || parseDate(min) || new Date()))
    setChooser('days')
    setOpen(true)
  }
  const commit = () => {
    if (!draft) return
    onChange?.({ target: { name, value: toISO(draft) } })
    setOpen(false)
  }
  const disabledDay = (date) => Boolean((minDate && toISO(date) < toISO(minDate)) || (maxDate && toISO(date) > toISO(maxDate)))
  const picker = open && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section aria-label={label || 'Choose date'} aria-modal="true" className="flex max-h-[min(90dvh,42rem)] w-full max-w-[26rem] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#101010] text-white shadow-2xl" role="dialog">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-400">{label || 'Select date'}</p>
            <p className="truncate text-xl font-semibold">{draft ? format(draft, 'EEE, dd MMM yyyy') : 'Choose a date'}</p>
          </div>
          <button aria-label="Close calendar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10" onClick={() => setOpen(false)} type="button"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button className="min-h-11 rounded-lg px-3 text-base font-semibold hover:bg-white/10" onClick={() => setChooser(chooser === 'months' ? 'days' : 'months')} type="button">{format(visibleMonth, 'MMMM')}</button>
              <button className="min-h-11 rounded-lg px-3 text-base font-semibold hover:bg-white/10" onClick={() => setChooser(chooser === 'years' ? 'days' : 'years')} type="button">{format(visibleMonth, 'yyyy')}</button>
            </div>
            {chooser === 'days' ? <div className="flex gap-1">
              <button aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" onClick={() => setVisibleMonth((month) => subMonths(month, 1))} type="button"><ChevronLeft className="h-5 w-5" /></button>
              <button aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} type="button"><ChevronRight className="h-5 w-5" /></button>
            </div> : null}
          </div>
          {chooser === 'months' ? <div className="grid grid-cols-3 gap-2">{Array.from({ length: 12 }, (_, month) => <button className={cn('min-h-12 rounded-xl px-2 text-sm hover:bg-white/10', month === visibleMonth.getMonth() && 'bg-teal-700 font-semibold')} key={month} onClick={() => { setVisibleMonth(new Date(visibleMonth.getFullYear(), month, 1)); setChooser('days') }} type="button">{format(new Date(2020, month, 1), 'MMM')}</button>)}</div>
            : chooser === 'years' ? <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">{years.map((year) => <button className={cn('min-h-12 rounded-xl text-sm hover:bg-white/10', year === visibleMonth.getFullYear() && 'bg-teal-700 font-semibold')} key={year} onClick={() => { setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1)); setChooser('days') }} type="button">{year}</button>)}</div>
              : <>
                <div className="grid grid-cols-7 text-center text-xs font-medium text-zinc-400">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span className="py-2" key={`${day}-${index}`}>{day}</span>)}</div>
                <div className="grid grid-cols-7 gap-y-1">{days.map((date, index) => date ? <button aria-label={format(date, 'EEEE, MMMM d, yyyy')} aria-pressed={sameDay(date, draft)} className={cn('mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-full text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:text-zinc-700', sameDay(date, draft) && 'bg-teal-600 font-semibold text-white hover:bg-teal-600')} disabled={disabledDay(date)} key={toISO(date)} onClick={() => setDraft(date)} type="button">{date.getDate()}</button> : <span aria-hidden="true" key={`empty-${index}`} />)}</div>
              </>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button className="min-h-11 rounded-lg px-3 text-sm font-semibold text-teal-300 hover:bg-white/10" onClick={() => { onChange?.({ target: { name, value: '' } }); setDraft(null); setOpen(false) }} type="button">Clear</button>
          <div className="flex gap-2"><button className="min-h-11 rounded-lg px-4 text-sm text-zinc-300 hover:bg-white/10" onClick={() => setOpen(false)} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white disabled:opacity-50" disabled={!draft || disabledDay(draft)} onClick={commit} type="button">Apply</button></div>
        </footer>
      </section>
    </div>, document.body,
  ) : null

  return <div className="block min-w-0 space-y-1.5">
    {label ? <span className="block text-sm font-medium text-ink">{label}{required ? <span aria-hidden="true"> *</span> : null}</span> : null}
    <button {...props} aria-label={`${label || 'Date'}${parsedValue ? `: ${format(parsedValue, 'PPP')}` : ''}`} className={cn('flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-ink shadow-sm outline-none transition hover:border-teal focus:border-teal focus:ring-2 focus:ring-teal/15 disabled:cursor-not-allowed disabled:opacity-60', className)} disabled={disabled} onClick={openPicker} type="button">
      <span className="truncate">{parsedValue ? format(parsedValue, 'dd MMM yyyy') : 'Select date'}</span><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
    {hint ? <span className="block text-xs text-dusk">{hint}</span> : null}
    {picker}
  </div>
}
