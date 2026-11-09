import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { acquireBodyScrollLock } from '../../lib/bodyScrollLock.js'

export const Modal = ({ open, onClose, title, description, children, footer, bodyClassName = '', fullScreen = false, mobileFullScreen = false, bottomSheet = false, size = 'wide' }) => {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const releaseScrollLock = acquireBodyScrollLock()
    const handleEscape = (e) => { if (e.key === 'Escape') onCloseRef.current?.() }
    window.addEventListener('keydown', handleEscape)

    return () => {
      releaseScrollLock()
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (!open) return null

  return createPortal((
    <div
      className={`fixed inset-0 z-[60] flex overflow-hidden overscroll-contain bg-ink/40 backdrop-blur-sm ${bottomSheet ? 'items-end p-0 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:items-center sm:justify-center sm:px-4 sm:py-4' : 'items-center justify-center'} ${fullScreen ? 'p-0 sm:px-4 sm:py-4' : bottomSheet ? '' : 'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]'} ${mobileFullScreen ? 'modal-mobile-fullscreen-backdrop' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`my-auto flex w-full min-w-0 flex-col overflow-hidden border border-slate-200 bg-white shadow-modal ${fullScreen ? 'h-full max-h-dvh max-w-none rounded-none sm:h-auto sm:max-w-md sm:rounded-2xl' : bottomSheet ? 'mb-0 max-w-none rounded-t-3xl sm:my-auto sm:max-w-sm sm:rounded-2xl' : `${size === 'profile' ? 'max-w-sm' : size === 'compact' ? 'max-w-sm' : 'max-w-2xl'} rounded-2xl`} ${mobileFullScreen ? 'modal-mobile-fullscreen-panel' : ''}`} style={{ maxHeight: fullScreen ? 'var(--app-viewport-height, 100dvh)' : 'calc(var(--app-viewport-height, 100dvh) - max(1rem, env(safe-area-inset-top)) - max(1rem, env(safe-area-inset-bottom)))' }}>
        {/* Header */}
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 ${fullScreen ? 'pt-[calc(1.25rem+env(safe-area-inset-top))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]' : ''}`}>
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
        <div className={`min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 ${fullScreen ? 'flex-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))]' : bottomSheet ? 'px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-5' : ''} ${bodyClassName}`}>{children}</div>
        {footer ? (
          <div className={`shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 ${fullScreen ? 'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]' : ''}`}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  ), document.body)
}
