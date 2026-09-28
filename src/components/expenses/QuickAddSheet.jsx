import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { EXPENSE_CATEGORIES } from '../../lib/constants'
import { getCategoryMeta } from '../../lib/categories'
import { currencySymbol, formatCurrency } from '../../lib/currency'
import { buildSplitAmongPayload, resolveSplitAmounts, validateSplitConfig } from '../../lib/splits'
import { getDisplayName } from '../../lib/utils'
import { ReceiptScanButton } from './ReceiptScanButton'
import { Button } from '../ui/Button'

const QUICK_AMOUNTS = [100, 200, 500, 1000]

const todayStamp = () => new Date().toISOString().slice(0, 10)

const clampDate = (trip) => {
  const today = todayStamp()
  if (trip?.startDate && today < trip.startDate) return trip.startDate
  if (trip?.endDate && today > trip.endDate) return trip.endDate
  return today
}

export const QuickAddSheet = ({
  open,
  onClose,
  onSubmit,
  onAdvanced,
  members = [],
  currency = 'INR',
  trip,
  currentUserId,
}) => {
  const defaultPayer = members.some((member) => member.uid === currentUserId)
    ? currentUserId
    : members[0]?.uid || ''
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [title, setTitle] = useState('')
  const [paidBy, setPaidBy] = useState(defaultPayer)
  const [selectedIds, setSelectedIds] = useState(() => members.map((member) => member.uid))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const symbol = currencySymbol(currency)
  const preview = useMemo(
    () =>
      resolveSplitAmounts({
        amount,
        splitMode: 'equal',
        splitAmong: buildSplitAmongPayload({
          splitMode: 'equal',
          selectedMemberIds: selectedIds,
          splitValues: {},
        }),
      }),
    [amount, selectedIds],
  )

  if (!open) return null

  const toggleMember = (uid) => {
    setSelectedIds((current) =>
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid],
    )
  }

  const buildValues = () => ({
    title: title.trim() || getCategoryMeta(category).label,
    amount,
    category,
    paidBy,
    date: clampDate(trip),
    note: '',
    splitMode: 'equal',
    receiptURL: '',
    splitAmong: buildSplitAmongPayload({
      splitMode: 'equal',
      selectedMemberIds: selectedIds,
      splitValues: {},
    }),
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const values = buildValues()
    const validation = validateSplitConfig({
      amount: values.amount,
      splitMode: 'equal',
      selectedMemberIds: selectedIds,
      splitValues: {},
    })

    if (!validation.valid) {
      toast.error(validation.message)
      return
    }

    if (!paidBy) {
      toast.error('Choose who paid.')
      return
    }

    setLoading(true)
    try {
      await onSubmit(values)
      onClose()
    } catch {
      // Parent surfaces Firebase errors.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button aria-label="Close add expense" className="absolute inset-0" onClick={onClose} type="button" />
      <form
        className="animate-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-modal sm:rounded-3xl"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Quick add</p>
            <h2 className="font-display text-xl font-bold text-ink">Add kharcha</h2>
          </div>
          <button
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-dusk"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-dusk">Amount</span>
            <div className="mt-2 flex items-baseline gap-2 border-b border-slate-200 pb-2">
              <span className="font-display text-3xl font-bold text-teal">{symbol}</span>
              <input
                autoFocus
                className="w-full bg-transparent font-display text-4xl font-bold text-ink outline-none placeholder:text-slate-300"
                inputMode="decimal"
                min="0"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
          </label>

          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-teal/10 hover:text-teal active:scale-95"
                onClick={() => setAmount(String(value))}
                type="button"
              >
                {formatCurrency(value, currency)}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Category</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {EXPENSE_CATEGORIES.map((item) => {
                const meta = getCategoryMeta(item)
                const active = category === item
                return (
                  <button
                    key={item}
                    className={`rounded-2xl border px-2 py-3 text-center transition active:scale-95 ${
                      active ? 'border-teal bg-teal/10' : 'border-slate-200 bg-white'
                    }`}
                    onClick={() => setCategory(item)}
                    type="button"
                  >
                    <span className="text-xl">{meta.emoji}</span>
                    <span className="mt-1 block text-xs font-semibold text-ink">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-dusk">What was it?</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/15"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={getCategoryMeta(category).label}
              value={title}
            />
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Paid by</p>
            <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-none">
              {members.map((member) => (
                <button
                  key={member.uid}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
                    paidBy === member.uid ? 'bg-ink text-white' : 'bg-slate-100 text-dusk'
                  }`}
                  onClick={() => setPaidBy(member.uid)}
                  type="button"
                >
                  {member.uid === currentUserId ? 'You' : member.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Split equally with</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {members.map((member) => {
                const active = selectedIds.includes(member.uid)
                return (
                  <button
                    key={member.uid}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
                      active ? 'bg-teal text-white' : 'bg-slate-100 text-dusk'
                    }`}
                    onClick={() => toggleMember(member.uid)}
                    type="button"
                  >
                    {member.uid === currentUserId ? 'You' : member.name}
                  </button>
                )
              })}
            </div>
          </div>

          <ReceiptScanButton
            onResult={(parsed) => {
              if (parsed.amount) setAmount(parsed.amount)
              if (parsed.title && !title) setTitle(parsed.title)
            }}
          />

          {preview.length ? (
            <p className="text-sm text-dusk">
              Each person:{' '}
              <span className="font-semibold text-ink">
                {formatCurrency(preview[0]?.amount || 0, currency)}
              </span>
              {preview.length > 1 ? ` · ${preview.map((item) => getDisplayName(members.find((member) => member.uid === item.uid))).join(', ')}` : ''}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-4">
          <Button
            onClick={() => {
              onAdvanced(buildValues())
              onClose()
            }}
            type="button"
            variant="secondary"
          >
            More options
          </Button>
          <Button loading={loading} type="submit">
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}
