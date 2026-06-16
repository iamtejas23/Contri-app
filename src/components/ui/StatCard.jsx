import { Card } from './Card'

const toneStyles = {
  coral: { dot: 'bg-coral',    icon: 'bg-orange-50 text-coral' },
  teal:  { dot: 'bg-teal',     icon: 'bg-teal-50 text-teal' },
  mint:  { dot: 'bg-mint',     icon: 'bg-teal-50 text-teal' },
  blue:  { dot: 'bg-blue-500', icon: 'bg-blue-50 text-blue-600' },
}

export const StatCard = ({ label, value, tone = 'teal', helper, icon: Icon }) => {
  const t = toneStyles[tone] ?? toneStyles.teal

  return (
    <Card className="relative overflow-hidden">
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${t.dot}`} />
      <div className="pl-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">{label}</p>
          {Icon ? (
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
        {helper ? <p className="mt-1 text-xs text-dusk">{helper}</p> : null}
      </div>
    </Card>
  )
}
