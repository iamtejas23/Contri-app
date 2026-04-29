import { cn } from '../../lib/utils'

export const Textarea = ({ label, className, ...props }) => (
  <label className="block space-y-2">
    {label ? (
      <span className="text-sm font-medium text-dusk">{label}</span>
    ) : null}
    <textarea
      className={cn(
        'min-h-[120px] w-full rounded-2xl border border-ink/10 bg-white/85 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-dusk/45 focus:border-teal focus:ring-4 focus:ring-teal/10',
        className,
      )}
      {...props}
    />
  </label>
)
