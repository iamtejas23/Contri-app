import { Eye, ExternalLink } from 'lucide-react'

import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { resolveExpenseCreator } from '../../lib/expenseCreators'
import { resolveSplitAmounts } from '../../lib/splits'
import { SeenByDialog } from './SeenByDialog'
import { SeenByIndicator } from './SeenByIndicator'
import { Avatar } from '../ui/Avatar'
import { Modal } from '../ui/Modal'
import { useState } from 'react'

export const ExpenseDetailDialog = ({ expense, open, onClose, currency, membersMap, creationActivityMap, views = [] }) => {
  const [showViewers, setShowViewers] = useState(false)
  if (!expense) return null

  const creator = resolveExpenseCreator(expense, membersMap, creationActivityMap)
  const payer = membersMap[expense.paidBy]
  const splitAmounts = resolveSplitAmounts({ ...expense, currency })

  return (
    <>
      <Modal description="Expense details" onClose={onClose} open={open} size="profile" title={expense.title || 'Expense details'}>
        <div className="space-y-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <p className="font-display text-3xl font-bold text-ink">{formatCurrency(expense.amount, currency)}</p>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-dusk">{expense.category || 'Other'}</span>
          </div>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-dusk">Paid by</dt>
              <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <Avatar label={`${payer?.name || 'Unknown member'} profile photo`} name={payer?.name || 'Unknown member'} size="sm" src={payer?.photoURL} uid={expense.paidBy} />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{payer?.name || 'Unknown member'}</span>
              </dd>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-dusk">Added by</dt>
              <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <Avatar label={`${creator.name} profile photo`} name={creator.name} size="sm" src={creator.photoURL} uid={creator.uid} />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{creator.name}</span>
              </dd>
            </div>
          </dl>
          <div className="min-w-0 rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-dusk">Expense date</p>
            <p className="mt-1 break-words text-sm font-medium text-ink">{formatDate(expense.date || expense.createdAt)}</p>
          </div>
          {expense.note ? <p className="break-words rounded-xl bg-slate-50 p-3 text-sm text-dusk [overflow-wrap:anywhere]">{expense.note}</p> : null}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Shares</h3>
            <ul className="space-y-2">
              {splitAmounts.map((share) => {
                const member = membersMap[share.uid]
                const name = member?.name || 'Unknown member'
                return (
                  <li className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 p-3" key={share.uid}>
                    <Avatar label={`${name} profile photo`} name={name} size="sm" src={member?.photoURL} uid={share.uid} />
                    <span className="min-w-0 flex-1 break-words text-sm text-ink [overflow-wrap:anywhere]">{name}</span>
                    <span className="shrink-0 text-sm font-semibold text-ink">{formatCurrency(share.amount, currency)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          {expense.receiptURL ? (
            <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-ink" href={expense.receiptURL} rel="noreferrer" target="_blank">
              <ExternalLink className="h-4 w-4" /> View receipt
            </a>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex min-w-0 items-center gap-1 text-xs text-dusk"><Eye className="h-4 w-4 flex-shrink-0" /> Seen by</div>
            <SeenByIndicator onClick={() => setShowViewers(true)} views={views} membersMap={membersMap} />
          </div>
        </div>
      </Modal>
      <SeenByDialog membersMap={membersMap} onClose={() => setShowViewers(false)} open={showViewers} views={views} />
    </>
  )
}
