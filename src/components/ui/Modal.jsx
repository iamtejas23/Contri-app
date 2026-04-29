import { useEffect } from 'react'
import { X } from 'lucide-react'

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
}) => {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[2rem] border border-white/60 bg-cream p-5 shadow-float sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-dusk/70">{description}</p>
            ) : null}
          </div>
          <button
            aria-label="Close modal"
            className="rounded-full bg-white/70 p-2 text-dusk transition hover:bg-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
