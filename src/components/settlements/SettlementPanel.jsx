import { Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { WhoOwesWhom } from './WhoOwesWhom'

import { SETTLEMENT_METHODS } from '../../lib/constants'
import { formatCurrency } from '../../lib/currency'
import { formatDate, isDateOutsideRange } from '../../lib/date'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

const buildInitialForm = (trip) => ({
  from: '',
  to: '',
  amount: '',
  method: 'upi',
  settledAt: trip?.endDate || trip?.startDate || new Date().toISOString().slice(0, 10),
  note: '',
})

export const SettlementPanel = ({
  trip, balances, suggestions, settlements, membersMap, members, onSubmit, canManage = false, currentUserId,
}) => {
  const [form, setForm]     = useState(() => buildInitialForm(trip))
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const filteredHistory = useMemo(() => {
    if (filter === 'all') return settlements
    return settlements.filter((s) => s.from === filter || s.to === filter)
  }, [filter, settlements])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isDateOutsideRange(form.settledAt, { min: trip?.startDate, max: trip?.endDate })) {
      toast.error('Settlement date must fall within the trip dates.')
      return
    }
    setLoading(true)
    try {
      await onSubmit(form)
      setForm(buildInitialForm(trip))
    } catch {
      /* parent shows toast */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">Who owes whom</h3>
        <p className="mt-0.5 text-sm text-dusk">The fewest payments that clear this trip.</p>
        <div className="mt-4">
          <WhoOwesWhom
            currency={trip.currency}
            currentUserId={currentUserId}
            membersMap={membersMap}
            onMarkPaid={canManage ? async (item) => {
              const today = new Date().toISOString().slice(0, 10)
              let settledAt = today
              if (trip?.startDate && settledAt < trip.startDate) settledAt = trip.startDate
              if (trip?.endDate && settledAt > trip.endDate) settledAt = trip.endDate
              await onSubmit({
                from: item.from,
                to: item.to,
                amount: String(item.amount),
                method: trip.currency === 'INR' ? 'upi' : 'online',
                settledAt,
                note: 'Marked from who owes whom',
              })
            } : undefined}
            suggestions={suggestions}
            tripName={trip.name}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        {/* Current balances */}
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink">Current balances</h3>
          <p className="mt-0.5 text-sm text-dusk">Who should receive and who should pay.</p>
          <div className="mt-4 space-y-2">
            {balances.map((entry) => (
              <div
                key={entry.uid}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-ink">{entry.name}</p>
                  <p className="text-xs text-dusk">
                    Paid {formatCurrency(entry.paid, trip.currency)} · Share {formatCurrency(entry.share, trip.currency)}
                  </p>
                </div>
                <p className={`font-display text-xl font-bold ${entry.net >= 0 ? 'text-teal' : 'text-coral'}`}>
                  {formatCurrency(entry.net, trip.currency)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Record settlement */}
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink">Record settlement</h3>
          <p className="mt-0.5 text-sm text-dusk">Mark a payment as done.</p>

          {suggestions.length && canManage ? (
            <div className="mt-4">
              <button
                className="text-sm font-semibold text-teal"
                onClick={() => {
                  const next = suggestions[0]
                  setForm((current) => ({
                    ...current,
                    from: next.from,
                    to: next.to,
                    amount: String(next.amount),
                  }))
                }}
                type="button"
              >
                Fill the next payment
              </button>
            </div>
          ) : null}

          {canManage ? (
            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="From"
                  onChange={(e) => setForm((c) => ({ ...c, from: e.target.value }))}
                  options={[{ value: '', label: 'Select payer' }, ...members.map((m) => ({ value: m.uid, label: m.name }))]}
                  value={form.from}
                />
                <Select
                  label="To"
                  onChange={(e) => setForm((c) => ({ ...c, to: e.target.value }))}
                  options={[{ value: '', label: 'Select receiver' }, ...members.map((m) => ({ value: m.uid, label: m.name }))]}
                  value={form.to}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="Amount" min="0" onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} required step="0.01" type="number" value={form.amount} />
                <Select label="Method" onChange={(e) => setForm((c) => ({ ...c, method: e.target.value }))} options={SETTLEMENT_METHODS} value={form.method} />
                <Input
                  hint={trip?.startDate && trip?.endDate ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}` : undefined}
                  label="Date" max={trip?.endDate} min={trip?.startDate}
                  onChange={(e) => setForm((c) => ({ ...c, settledAt: e.target.value }))}
                  required type="date" value={form.settledAt}
                />
              </div>
              <Input label="Note" onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} placeholder="UPI ref, cash handoff…" value={form.note} />
              <Button loading={loading} type="submit">Record settlement</Button>
            </form>
          ) : (
            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-dusk">
              Only trip admins can record settlements.
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Settlement history</h3>
            <p className="mt-0.5 text-sm text-dusk">Every payment already recorded.</p>
          </div>
          <div className="w-full sm:w-56">
            <Select
              onChange={(e) => setFilter(e.target.value)}
              options={[{ value: 'all', label: 'All members' }, ...members.map((m) => ({ value: m.uid, label: m.name }))]}
              value={filter}
            />
          </div>
        </div>

        {filteredHistory.length ? (
          <div className="mt-4 space-y-2">
            {filteredHistory.map((s) => (
              <div key={s.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-ink">
                    {membersMap[s.from]?.name} <span className="text-dusk">paid</span> {membersMap[s.to]?.name}
                  </p>
                  <p className="text-xs text-dusk">
                    {formatDate(s.settledAt)} · {s.method.toUpperCase()}
                    {s.note ? ` · ${s.note}` : ''}
                  </p>
                </div>
                <p className="font-display text-xl font-bold text-ink">
                  {formatCurrency(s.amount, trip.currency)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState description="Settlements appear here as soon as someone records a payment." icon={Wallet} title="No settlements yet" />
          </div>
        )}
      </Card>
    </div>
  )
}
