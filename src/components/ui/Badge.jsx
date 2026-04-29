import { cn } from '../../lib/utils'

export const Badge = ({ children, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-dusk/80',
      className,
    )}
  >
    {children}
  </span>
)
