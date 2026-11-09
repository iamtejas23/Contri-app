import { Eye, PencilLine, Receipt, Search, Trash2 } from 'lucide-react'

import { getCategoryMeta } from '../../lib/categories'
import { useMemo, useState } from 'react'

import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { buildExpenseCreationActivityMap, resolveExpenseCreator } from '../../lib/expenseCreators'
import { sortExpensesNewestFirst } from '../../lib/expenseSorting'
import { canViewTripReceipts } from '../../lib/receiptPermissions'
import { resolveSplitAmounts } from '../../lib/splits'
import { MemberAvatar } from '../ui/MemberAvatar'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Select } from '../ui/Select'
import { ExpenseDetailDialog } from './ExpenseDetailDialog'

export const ExpenseList = ({ expenses, membersMap, activity = [], currency, onEdit, onDelete, onCreate, currentUserId, currentUser, trip, canManage = false, targetExpenseId = '', onDismissTarget }) => {
  const [search, setSearch]               = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedExpenseState, setSelectedExpenseState] = useState(null)
  const selectedExpense = selectedExpenseState || expenses.find((expense) => expense.id === targetExpenseId) || null
  const creationActivityMap = useMemo(() => buildExpenseCreationActivityMap(activity), [activity])

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses])

  const filtered = useMemo(() => {
    let result = expenses
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (membersMap[e.paidBy]?.name || '').toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'all') result = result.filter((e) => e.category === categoryFilter)
    return result
  }, [expenses, search, categoryFilter, membersMap])
  const newestFirst = useMemo(() => sortExpensesNewestFirst(filtered, creationActivityMap), [filtered, creationActivityMap])
  const canViewReceipts = canViewTripReceipts(trip, currentUser || { uid: currentUserId })

  if (!expenses.length) {
    return (
      <EmptyState
        actionLabel={onCreate ? 'Add first kharcha' : undefined}
        description="Petrol, toll, dinner, hotel — log it in a few taps and the hisab updates for everyone."
        icon={Receipt}
        onAction={onCreate}
        title="No kharcha yet"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="min-w-0 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/15"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses…"
              value={search}
            />
          </div>
            <div className="flex min-w-0 flex-wrap gap-2">
            <Select
              aria-label="Filter expenses by category"
              className="flex-1 rounded-lg sm:flex-none"
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[{ value: 'all', label: 'All categories' }, ...categories.map((category) => ({ value: category, label: category }))]}
              value={categoryFilter}
            />
          </div>
        </div>
        {(search || categoryFilter !== 'all') && (
          <p className="mt-2 text-xs text-dusk">{filtered.length} of {expenses.length} expenses</p>
        )}
      </Card>

      {filtered.length === 0 ? (
        <EmptyState description="Try a different search or filter." title="No matching expenses" />
      ) : (
        newestFirst.map((expense) => {
          const meta = getCategoryMeta(expense.category)
          const splitItems = resolveSplitAmounts({ ...expense, currency })
          const creator = resolveExpenseCreator(expense, membersMap, creationActivityMap)

          return (
            <Card key={expense.id} className="min-w-0 overflow-hidden p-0">
              <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base ${meta.tone}`}>
                      {meta.emoji}
                    </span>
                    <p className="min-w-0 break-words font-display text-lg font-semibold text-ink">{expense.title || 'Untitled expense'}</p>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${meta.tone}`}>
                      {expense.category}
                    </span>
                  </div>

                  <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-dusk">
                      <MemberAvatar label={`${creator.name}, expense creator`} member={{ ...membersMap[creator.uid], ...creator }} name={creator.name} size="xs" src={creator.photoURL} uid={creator.uid} />
                      <span className="min-w-0">Added by <span className="break-words font-semibold text-ink">{creator.name}</span></span>
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="min-w-0 break-words text-sm text-dusk [overflow-wrap:anywhere]">
                      Paid by <span className="font-semibold text-ink">{membersMap[expense.paidBy]?.name || 'Unknown member'}</span>
                    </span>
                    <span className="hidden text-slate-300 sm:inline" aria-hidden="true">·</span>
                    <span className="text-sm text-dusk">{formatDate(expense.date || expense.createdAt || expense.updatedAt)}</span>
                  </div>

                  {expense.note ? (
                    <p className="mt-2.5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-dusk">
                      {expense.note}
                    </p>
                  ) : null}

                  {splitItems.length ? (
                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-1.5 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap">
                      {splitItems.map((item) => (
                        <span key={item.uid} className="inline-flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-dusk sm:max-w-full">
                          <MemberAvatar label={`${membersMap[item.uid]?.name || 'Member'} avatar`} member={membersMap[item.uid]} name={membersMap[item.uid]?.name} size="xs" src={membersMap[item.uid]?.photoURL} uid={item.uid} />
                          <span className="min-w-0 break-words">{membersMap[item.uid]?.name || 'Unknown member'}: <span className="font-semibold text-ink">{formatCurrency(item.amount, currency)}</span></span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

              <div className="flex min-w-0 flex-col items-start gap-3 border-t border-slate-100 pt-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:gap-4 min-[480px]:border-0 min-[480px]:pt-0 sm:flex-col sm:items-end">
                  <p className="shrink-0 font-display text-2xl font-bold text-ink">
                    {formatCurrency(expense.amount, currency)}
                  </p>
                <div className="flex w-full min-w-0 flex-wrap justify-start gap-2 min-[480px]:w-auto min-[480px]:justify-end">
                  <Button className="min-w-[5.5rem] justify-center" onClick={() => setSelectedExpenseState(expense)} size="sm" type="button" variant="secondary">
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </Button>
                    {expense.receiptURL && canViewReceipts ? (
                      <a
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-dusk shadow-sm transition hover:bg-slate-50"
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
                        <Button className="min-w-[5rem] justify-center" onClick={() => onEdit(expense)} size="sm" type="button" variant="secondary">
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button aria-label={`Delete ${expense.title || 'expense'}`} className="min-w-11 justify-center" onClick={() => onDelete(expense)} size="sm" type="button" variant="danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-3 py-1.5 sm:px-4">
                {currentUserId === creator.uid ? <span className="text-[11px] text-dusk">You added this</span> : null}
              </div>
            </Card>
          )
        })
      )}

      <ExpenseDetailDialog
        canManage={canManage}
        creationActivityMap={creationActivityMap}
        currency={currency}
        currentUser={currentUser}
        expense={selectedExpense}
        membersMap={membersMap}
        onClose={() => {
          setSelectedExpenseState(null)
          onDismissTarget?.()
        }}
        open={Boolean(selectedExpense)}
        trip={trip}
      />
    </div>
  )
}
