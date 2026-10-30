import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

/** A touch-friendly select rendered in a body portal to escape clipped cards/modals. */
export const Select = ({ label, options = [], className, onChange, value, name, disabled, id, ...props }) => {
  const generatedId = useId()
  const controlId = id || generatedId
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState(null)
  const current = options.find((option) => String(option.value) === String(value))

  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const positionMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 8
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - margin * 2)
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))
    const below = window.innerHeight - rect.bottom - margin
    const above = rect.top - margin
    const placeAbove = below < Math.min(240, above) && above > below
    const maxHeight = Math.max(112, Math.min(320, (placeAbove ? above : below) - 4))
    setPlacement({ left, width, maxHeight, top: placeAbove ? undefined : rect.bottom + 4, bottom: placeAbove ? window.innerHeight - rect.top + 4 : undefined })
  }

  useEffect(() => {
    if (!open) return undefined
    positionMenu()
    const handlePointer = (event) => {
      if (!triggerRef.current?.contains(event.target) && !event.target.closest?.(`[data-select-menu="${controlId}"]`)) close()
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const enabled = options.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0)
        if (!enabled.length) return
        const active = enabled.indexOf(document.activeElement?.dataset?.optionIndex * 1)
        const start = active < 0 ? enabled.findIndex((index) => String(options[index].value) === String(value)) : active
        const next = enabled[(Math.max(0, start) + (event.key === 'ArrowDown' ? 1 : enabled.length - 1)) % enabled.length]
        optionRefs.current[next]?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open, options, value, controlId])

  const select = (option) => {
    if (option.disabled) return
    onChange?.({ target: { name, value: option.value } })
    close(true)
  }

  const menu = open && placement && typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
      data-select-menu={controlId}
      role="listbox"
      aria-labelledby={controlId}
      style={{ left: placement.left, width: placement.width, maxHeight: placement.maxHeight, top: placement.top, bottom: placement.bottom }}
    >
      {options.map((option, index) => {
        const selected = String(option.value) === String(value)
        return <button
          key={`${option.value}-${index}`}
          ref={(node) => { optionRefs.current[index] = node }}
          aria-selected={selected}
          className={cn('flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm text-ink hover:bg-slate-100 focus:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50', selected && 'bg-teal/10 font-semibold')}
          data-option-index={index}
          disabled={option.disabled}
          onClick={() => select(option)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(option) }
            if (event.key === 'Home') { event.preventDefault(); optionRefs.current[0]?.focus() }
            if (event.key === 'End') { event.preventDefault(); optionRefs.current[options.length - 1]?.focus() }
          }}
          role="option"
          type="button"
        >
          <span className="min-w-0 break-words">{option.label}</span>
          {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-teal" /> : null}
        </button>
      })}
    </div>, document.body,
  ) : null

  return <label className="block min-w-0 space-y-1.5">
    {label ? <span className="text-sm font-medium text-ink">{label}</span> : null}
    <button
      {...props}
      ref={triggerRef}
      id={controlId}
      aria-label={props['aria-label'] || label}
      aria-expanded={open}
      aria-haspopup="listbox"
      className={cn('flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-ink shadow-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15 disabled:cursor-not-allowed disabled:opacity-60', className)}
      disabled={disabled}
      onClick={() => { if (!disabled) { setOpen((shown) => !shown); setTimeout(positionMenu, 0) } }}
      onKeyDown={(event) => {
        if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setOpen(true); setTimeout(() => { positionMenu(); optionRefs.current[options.findIndex((item) => String(item.value) === String(value))]?.focus() }, 0) }
      }}
      type="button"
    >
      <span className="min-w-0 break-words">{current?.label ?? (value || 'Select')}</span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
    {menu}
  </label>
}
