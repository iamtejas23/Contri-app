import { PencilLine, Receipt, Trash2 } from 'lucide-react'

import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { resolveSplitAmounts } from '../../lib/splits'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'

export const ExpenseList = ({
  expenses,
  membersMap,
  currency,
  onEdit,
  onDelete,
  onCreate,
}) => {
  if (!expenses.length) {
    return (
      <EmptyState
        actionLabel="Add first expense"
        description="Add the first bill and the dashboard will start calculating balances in real time."
        onAction={onCreate}
        title="No expenses yet"
      />
    )
  }

  return (
    <div className="space-y-4">
      {expenses.map((expense) => {
        const splitPreview = resolveSplitAmounts(expense)
        return (
          <Card key={expense.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-2xl font-bold text-ink">{expense.title}</p>
                  <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-dusk">
                    {expense.category}
                  </span>
                </div>

                <p className="mt-2 text-sm text-dusk/70">
                  Paid by <span className="font-semibold text-ink">{membersMap[expense.paidBy]?.name}</span>
                  {' · '}
                  {formatDate(expense.date)}
                </p>

                {expense.note ? (
                  <p className="mt-3 rounded-2xl bg-sand/70 px-4 py-3 text-sm text-dusk/75">
                    {expense.note}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {splitPreview.map((item) => (
                    <span
                      key={item.uid}
                      className="rounded-full bg-ink/5 px-3 py-2 text-sm text-dusk"
                    >
                      {membersMap[item.uid]?.name}: {formatCurrency(item.amount, currency)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <p className="font-display text-3xl font-bold text-ink">
                  {formatCurrency(expense.amount, currency)}
                </p>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {expense.receiptURL ? (
                    <a
                      className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-dusk ring-1 ring-ink/10"
                      href={expense.receiptURL}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Receipt className="h-4 w-4" />
                      Receipt
                    </a>
                  ) : null}
                  <Button onClick={() => onEdit(expense)} type="button" variant="secondary">
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button onClick={() => onDelete(expense)} type="button" variant="danger">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
