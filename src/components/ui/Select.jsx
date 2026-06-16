import { ChevronDown } from 'lucide-react'

import { cn } from '../../lib/utils'

export const Select = ({ label, options = [], className, ...props }) => (
  <label className="block space-y-1.5">
    {label ? (
      <span className="text-sm font-medium text-ink">{label}</span>
    ) : null}
    <span className="relative block">
      <select
        className={cn(
          'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-ink shadow-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </span>
  </label>
)
