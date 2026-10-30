import { cn } from '../../lib/utils'

export const Input = ({ label, hint, className, ...props }) => (
  <label className="block min-w-0 space-y-1.5">
    {label ? (
      <span className="text-sm font-medium text-ink">{label}</span>
    ) : null}
    <input
      className={cn(
        'min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...props}
    />
    {hint ? <span className="text-xs text-dusk">{hint}</span> : null}
  </label>
)
