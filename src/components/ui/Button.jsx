import { LoaderCircle } from 'lucide-react'

import { cn } from '../../lib/utils'

const variants = {
  primary:   'bg-teal text-white shadow-sm hover:bg-teal/90 active:scale-[0.98]',
  secondary: 'bg-white text-ink border border-slate-200 shadow-sm hover:bg-sand active:bg-slate-100',
  ghost:     'text-dusk hover:bg-slate-100 hover:text-ink',
  danger:    'bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-[0.98]',
  white:     'bg-white text-ink shadow-sm hover:bg-slate-50 border border-slate-100',
}

const sizes = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
}

export const Button = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  ...props
}) => (
  <button
    className={cn(
      'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 select-none',
      variants[variant],
      sizes[size],
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
    {children}
  </button>
)
