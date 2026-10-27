import { useEffect } from 'react'
import { X } from 'lucide-react'

export const Modal = ({ open, onClose, title, description, children }) => {
  useEffect(() => {
    if (!open) return undefined

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/40 px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-modal" style={{ maxHeight: 'calc(100dvh - max(2rem, env(safe-area-inset-top)) - max(2rem, env(safe-area-inset-bottom)))' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-dusk">{description}</p>
            ) : null}
          </div>
          <button
            aria-label="Close"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body */}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  )
}
