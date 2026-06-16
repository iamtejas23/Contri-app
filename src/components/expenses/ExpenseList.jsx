import {
  Hotel, Package, PencilLine, Plane, Receipt,
  Search, ShoppingBag, Trash2, UtensilsCrossed, Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { resolveSplitAmounts } from '../../lib/splits'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'

const CATEGORY_META = {
  Food:     { icon: UtensilsCrossed, bg: 'bg-orange-100', text: 'text-orange-600' },
  Travel:   { icon: Plane,           bg: 'bg-teal-100',   text: 'text-teal-600' },
  Stay:     { icon: Hotel,           bg: 'bg-blue-100',   text: 'text-blue-600' },
  Activity: { icon: Zap,             bg: 'bg-yellow-100', text: 'text-yellow-700' },
  Shopping: { icon: ShoppingBag,     bg: 'bg-purple-100', text: 'text-purple-600' },
  Other:    { icon: Package,         bg: 'bg-slate-100',  text: 'text-slate-600' },
}

export const ExpenseList = ({ expenses, membersMap, currency, onEdit, onDelete, onCreate, canManage = false }) => {
  const [search, setSearch]               = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy]               = useState('date-desc')

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses])

  const filtered = useMemo(() => {
    let result = expenses
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (membersMap[e.paidBy]?.name || '').toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'all') result = result.filter((e) => e.category === categoryFilter)
    return [...result].sort((a, b) => {
      if (sortBy === 'date-asc')    return a.date.localeCompare(b.date)
      if (sortBy === 'amount-desc') return b.amount - a.amount
      if (sortBy === 'amount-asc')  return a.amount - b.amount
      return b.date.localeCompare(a.date)
    })
  }, [expenses, search, categoryFilter, sortBy, membersMap])

  if (!expenses.length) {
    return (
      <EmptyState
        actionLabel={canManage ? 'Add first expense' : undefined}
        description="Add the first bill and the dashboard will start calculating balances in real time."
        icon={Receipt}
        onAction={canManage ? onCreate : undefined}
        title="No expenses yet"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/15"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses…"
              value={search}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
              onChange={(e) => setCategoryFilter(e.target.value)}
              value={categoryFilter}
            >
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
              onChange={(e) => setSortBy(e.target.value)}
              value={sortBy}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
            </select>
          </div>
        </div>
        {(search || categoryFilter !== 'all') && (
          <p className="mt-2 text-xs text-dusk">{filtered.length} of {expenses.length} expenses</p>
        )}
      </Card>

      {filtered.length === 0 ? (
        <EmptyState description="Try a different search or filter." title="No matching expenses" />
      ) : (
        filtered.map((expense) => {
          const meta       = CATEGORY_META[expense.category] ?? CATEGORY_META.Other
          const Icon       = meta.icon
          const splitItems = resolveSplitAmounts(expense)

          return (
            <Card key={expense.id} className="p-0 overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.text}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="font-display text-lg font-semibold text-ink">{expense.title}</p>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}>
                      {expense.category}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-dusk">
                    Paid by <span className="font-semibold text-ink">{membersMap[expense.paidBy]?.name ?? '—'}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    {formatDate(expense.date)}
                  </p>

                  {expense.note ? (
                    <p className="mt-2.5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-dusk">
                      {expense.note}
                    </p>
                  ) : null}

                  {splitItems.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {splitItems.map((item) => (
                        <span key={item.uid} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-dusk">
                          {membersMap[item.uid]?.name}:{' '}
                          <span className="font-semibold text-ink">{formatCurrency(item.amount, currency)}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="font-display text-2xl font-bold text-ink">
                    {formatCurrency(expense.amount, currency)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expense.receiptURL ? (
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-dusk shadow-sm transition hover:bg-slate-50"
                        href={expense.receiptURL}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Receipt
                      </a>
                    ) : null}
                    {canManage ? (
                      <>
                        <Button onClick={() => onEdit(expense)} size="sm" type="button" variant="secondary">
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button onClick={() => onDelete(expense)} size="sm" type="button" variant="danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
