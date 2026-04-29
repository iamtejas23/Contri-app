import { cn } from '../../lib/utils'

export const Card = ({ className, children }) => (
  <div
    className={cn(
      'rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-float backdrop-blur',
      className,
    )}
  >
    {children}
  </div>
)
