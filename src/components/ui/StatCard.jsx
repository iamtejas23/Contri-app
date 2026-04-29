import { Card } from './Card'

export const StatCard = ({ label, value, tone = 'coral', helper }) => (
  <Card className="relative overflow-hidden p-5">
    <div
      className={`absolute inset-x-0 top-0 h-1.5 ${
        tone === 'teal' ? 'bg-teal' : tone === 'mint' ? 'bg-mint' : 'bg-coral'
      }`}
    />
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk/60">
      {label}
    </p>
    <p className="mt-3 font-display text-3xl font-bold text-ink">{value}</p>
    {helper ? <p className="mt-2 text-sm text-dusk/65">{helper}</p> : null}
  </Card>
)
