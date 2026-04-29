import { useMemo, useState } from 'react'

import { SETTLEMENT_METHODS } from '../../lib/constants'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

const initialForm = {
  from: '',
  to: '',
  amount: '',
  method: 'upi',
  settledAt: new Date().toISOString().slice(0, 10),
  note: '',
}

export const SettlementPanel = ({
  trip,
  balances,
  suggestions,
  settlements,
  membersMap,
  members,
  onSubmit,
}) => {
  const [form, setForm] = useState(initialForm)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const filteredHistory = useMemo(() => {
    if (filter === 'all') {
      return settlements
    }

    return settlements.filter((item) => item.from === filter || item.to === filter)
  }, [filter, settlements])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      await onSubmit(form)
      setForm(initialForm)
    } catch {
      // Parent/service layer already shows a toast for Firebase failures.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
            Current balances
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">
            Who should receive and who should pay
          </h3>
          <div className="mt-5 space-y-3">
            {balances.map((entry) => (
              <div
                key={entry.uid}
                className="flex items-center justify-between rounded-[1.5rem] bg-sand/75 px-4 py-4"
              >
                <div>
                  <p className="font-semibold text-ink">{entry.name}</p>
                  <p className="text-sm text-dusk/65">
                    Paid {formatCurrency(entry.paid, trip.currency)} · Share{' '}
                    {formatCurrency(entry.share, trip.currency)}
                  </p>
                </div>
                <p
                  className={`font-display text-2xl font-bold ${
                    entry.net >= 0 ? 'text-teal' : 'text-coral'
                  }`}
                >
                  {formatCurrency(entry.net, trip.currency)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
            Record settlement
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">
            Mark a payment as done
          </h3>

          {suggestions.length ? (
            <div className="mt-4 space-y-3">
              {suggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={`${suggestion.from}-${suggestion.to}`}
                  className="w-full rounded-[1.5rem] border border-ink/10 bg-white/70 px-4 py-3 text-left transition hover:bg-white"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      from: suggestion.from,
                      to: suggestion.to,
                      amount: String(suggestion.amount),
                    }))
                  }
                  type="button"
                >
                  <p className="font-semibold text-ink">
                    {membersMap[suggestion.from]?.name} pays {membersMap[suggestion.to]?.name}
                  </p>
                  <p className="mt-1 text-sm text-dusk/65">
                    {formatCurrency(suggestion.amount, trip.currency)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-[1.5rem] bg-sand/70 px-4 py-3 text-sm text-dusk/70">
              No suggested settlements right now. The balances are already close to settled.
            </p>
          )}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="From"
                onChange={(event) =>
                  setForm((current) => ({ ...current, from: event.target.value }))
                }
                options={[
                  { value: '', label: 'Select payer' },
                  ...members.map((member) => ({ value: member.uid, label: member.name })),
                ]}
                value={form.from}
              />
              <Select
                label="To"
                onChange={(event) =>
                  setForm((current) => ({ ...current, to: event.target.value }))
                }
                options={[
                  { value: '', label: 'Select receiver' },
                  ...members.map((member) => ({ value: member.uid, label: member.name })),
                ]}
                value={form.to}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Amount"
                min="0"
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
                required
                step="0.01"
                type="number"
                value={form.amount}
              />
              <Select
                label="Method"
                onChange={(event) =>
                  setForm((current) => ({ ...current, method: event.target.value }))
                }
                options={SETTLEMENT_METHODS}
                value={form.method}
              />
              <Input
                label="Date"
                onChange={(event) =>
                  setForm((current) => ({ ...current, settledAt: event.target.value }))
                }
                type="date"
                value={form.settledAt}
              />
            </div>
            <Input
              label="Note"
              onChange={(event) =>
                setForm((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="UPI transfer reference, cash handoff, etc."
              value={form.note}
            />
            <Button loading={loading} type="submit">
              Record settlement
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
              Settlement history
            </p>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">
              Every payment already recorded
            </h3>
          </div>
          <div className="w-full sm:w-64">
            <Select
              label="Filter by member"
              onChange={(event) => setFilter(event.target.value)}
              options={[
                { value: 'all', label: 'All members' },
                ...members.map((member) => ({ value: member.uid, label: member.name })),
              ]}
              value={filter}
            />
          </div>
        </div>

        {filteredHistory.length ? (
          <div className="mt-5 space-y-3">
            {filteredHistory.map((settlement) => (
              <div
                key={settlement.id}
                className="flex flex-col justify-between gap-3 rounded-[1.5rem] bg-sand/75 px-4 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {membersMap[settlement.from]?.name} paid {membersMap[settlement.to]?.name}
                  </p>
                  <p className="text-sm text-dusk/65">
                    {formatDate(settlement.settledAt)} · {settlement.method.toUpperCase()}
                    {settlement.note ? ` · ${settlement.note}` : ''}
                  </p>
                </div>
                <p className="font-display text-2xl font-bold text-ink">
                  {formatCurrency(settlement.amount, trip.currency)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              description="Settlements show up here as soon as someone records a payment."
              title="No settlements yet"
            />
          </div>
        )}
      </Card>
    </div>
  )
}
