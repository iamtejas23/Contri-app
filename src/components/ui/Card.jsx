import { cn } from '../../lib/utils'

export const Card = ({ className, children }) => (
  <div
    className={cn(
      'rounded-2xl border border-slate-200 bg-white p-5 shadow-card',
      className,
    )}
  >
    {children}
  </div>
)
