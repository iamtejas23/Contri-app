import { cn } from '../../lib/utils'

export const Textarea = ({ label, hint, className, ...props }) => (
  <label className="block space-y-1.5">
    {label ? (
      <span className="text-sm font-medium text-ink">{label}</span>
    ) : null}
    <textarea
      className={cn(
        'min-h-[100px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/15',
        className,
      )}
      {...props}
    />
    {hint ? <span className="text-xs text-dusk">{hint}</span> : null}
  </label>
)
