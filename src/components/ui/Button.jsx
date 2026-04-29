import { LoaderCircle } from 'lucide-react'

import { cn } from '../../lib/utils'

const variants = {
  primary:
    'bg-ink text-white shadow-lg shadow-ink/15 hover:-translate-y-0.5 hover:bg-dusk',
  secondary:
    'bg-white/80 text-ink ring-1 ring-ink/10 hover:-translate-y-0.5 hover:bg-white',
  ghost: 'bg-transparent text-ink hover:bg-white/70',
  danger:
    'bg-coral text-white shadow-lg shadow-coral/20 hover:-translate-y-0.5 hover:bg-coral/90',
}

const sizes = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
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
      'inline-flex items-center justify-center gap-2 rounded-full font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-60',
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
