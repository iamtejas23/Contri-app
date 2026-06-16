import { cn } from '../../lib/utils'

const tones = {
  default: 'bg-slate-100 text-slate-600',
  teal:    'bg-teal/10 text-teal',
  coral:   'bg-orange-100 text-orange-600',
  mint:    'bg-teal-50 text-teal-600',
  amber:   'bg-amber-100 text-amber-700',
  green:   'bg-green-100 text-green-700',
  red:     'bg-red-100 text-red-600',
  blue:    'bg-blue-100 text-blue-700',
}

export const Badge = ({ children, className, tone = 'default' }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
      tones[tone] ?? tones.default,
      className,
    )}
  >
    {children}
  </span>
)
