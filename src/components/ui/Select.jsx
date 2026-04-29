import { ChevronDown } from 'lucide-react'

import { cn } from '../../lib/utils'

export const Select = ({ label, options = [], className, ...props }) => (
  <label className="block space-y-2">
    {label ? (
      <span className="text-sm font-medium text-dusk">{label}</span>
    ) : null}
    <span className="relative block">
      <select
        className={cn(
          'w-full appearance-none rounded-2xl border border-ink/10 bg-white/85 px-4 py-3 pr-10 text-sm text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10',
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
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dusk/60" />
    </span>
  </label>
)
