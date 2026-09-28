import { formatCurrency } from '../../lib/currency'

export const BudgetBar = ({ spent = 0, budget = 0, currency = 'INR' }) => {
  if (!budget) {
    return null
  }

  const ratio = Math.min(spent / budget, 1)
  const over = spent > budget + 0.01
  const left = budget - spent

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Trip budget</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">
            {formatCurrency(spent, currency)}
            <span className="text-sm font-medium text-dusk"> of {formatCurrency(budget, currency)}</span>
          </p>
        </div>
        <p className={`text-sm font-semibold ${over ? 'text-coral' : 'text-teal'}`}>
          {over
            ? `${formatCurrency(Math.abs(left), currency)} over`
            : `${formatCurrency(left, currency)} left`}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-coral' : 'bg-teal'}`}
          style={{ width: `${Math.max(ratio * 100, spent > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}
