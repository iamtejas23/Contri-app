import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link2 } from 'lucide-react'

import { getCategoryMeta } from '../../lib/categories'
import {
  DEFAULT_EXPENSE_FORM,
  EXPENSE_CATEGORIES,
  SPLIT_MODES,
} from '../../lib/constants'
import { ReceiptScanButton } from './ReceiptScanButton'
import { formatCurrency } from '../../lib/currency'
import { formatDate, isDateOutsideRange } from '../../lib/date'
import {
  buildSplitAmongPayload,
  getSelectedMemberIds,
  getSplitValueMap,
  resolveSplitAmounts,
  validateSplitConfig,
} from '../../lib/splits'
import { getDisplayName, isValidUrl } from '../../lib/utils'
import { Button } from '../ui/Button'
import { DatePicker } from '../ui/DatePicker'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Avatar } from '../ui/Avatar'
import { Textarea } from '../ui/Textarea'

const buildInitialForm = (members, initialExpense, trip) => ({
  ...DEFAULT_EXPENSE_FORM,
  ...initialExpense,
  paidBy: initialExpense?.paidBy || members[0]?.uid || '',
  amount: initialExpense?.amount ? String(initialExpense.amount) : '',
  date: initialExpense?.date || trip?.startDate || DEFAULT_EXPENSE_FORM.date,
  receiptURL: initialExpense?.receiptURL || '',
})

export const ExpenseFormModal = ({
  open,
  onClose,
  onSubmit,
  members = [],
  currency,
  initialExpense,
  trip,
}) => {
  const [form, setForm] = useState(() => buildInitialForm(members, initialExpense, trip))
  const [selectedMemberIds, setSelectedMemberIds] = useState(() =>
    getSelectedMemberIds(members, initialExpense?.splitAmong || []),
  )
  const [splitValues, setSplitValues] = useState(() =>
    getSplitValueMap(members, initialExpense?.splitMode || 'equal', initialExpense?.splitAmong || []),
  )
  const [loading, setLoading] = useState(false)

  const previewSplit = useMemo(
    () =>
      resolveSplitAmounts({
        amount: form.amount,
        splitMode: form.splitMode,
        splitAmong: buildSplitAmongPayload({
          splitMode: form.splitMode,
          selectedMemberIds,
          splitValues,
        }),
      }),
    [form.amount, form.splitMode, selectedMemberIds, splitValues],
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const toggleMember = (uid) => {
    setSelectedMemberIds((current) =>
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid],
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    if (!form.date) {
      toast.error('Choose an expense date.')
      return
    }

    const validation = validateSplitConfig({
      amount: form.amount,
      splitMode: form.splitMode,
      selectedMemberIds,
      splitValues,
    })

    if (!validation.valid) {
      toast.error(validation.message)
      return
    }

    if (
      isDateOutsideRange(form.date, {
        min: trip?.startDate,
        max: trip?.endDate,
      })
    ) {
      toast.error('Expense date must fall within the trip dates.')
      return
    }

    if (!isValidUrl(form.receiptURL)) {
      toast.error('Add a valid receipt link that starts with http:// or https://.')
      return
    }

    setLoading(true)

    try {
      await onSubmit({
        ...form,
        splitAmong: buildSplitAmongPayload({
          splitMode: form.splitMode,
          selectedMemberIds,
          splitValues,
        }),
      })
      onClose()
    } catch {
      // Parent/service layer already shows a toast for Firebase failures.
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      description="Track the bill, attach a receipt, and decide exactly who owes what."
      onClose={onClose}
      open={open}
      title={initialExpense?.id ? 'Edit expense' : 'Add expense'}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Title"
            name="title"
            onChange={handleChange}
            placeholder="Airport cab"
            required
            value={form.title}
          />
          <Input
            label="Amount"
            min="0"
            name="amount"
            onChange={handleChange}
            placeholder="2450"
            required
            step="0.01"
            type="number"
            value={form.amount}
          />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-ink">Category</span>
          <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
            {EXPENSE_CATEGORIES.map((item) => {
              const meta = getCategoryMeta(item)
              const active = form.category === item
              return (
                <button
                  key={item}
                  className={`rounded-2xl border px-2 py-2.5 text-center transition active:scale-95 ${
                    active ? 'border-teal bg-teal/10' : 'border-slate-200 bg-white'
                  }`}
                  onClick={() => setForm((current) => ({ ...current, category: item }))}
                  type="button"
                >
                  <span className="text-lg">{meta.emoji}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-ink">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Paid by"
            name="paidBy"
            onChange={handleChange}
            options={members.map((member) => ({
              value: member.uid,
              label: member.name,
            }))}
            value={form.paidBy}
          />
          <DatePicker
            hint={
              trip?.startDate && trip?.endDate
                ? `${formatDate(trip.startDate)} to ${formatDate(trip.endDate)}`
                : undefined
            }
            label="Date"
            max={trip?.endDate || undefined}
            min={trip?.startDate || undefined}
            name="date"
            onChange={handleChange}
            required
            value={form.date}
          />
        </div>

        <Textarea
          label="Note"
          name="note"
          onChange={handleChange}
          placeholder="Anything the group should remember?"
          value={form.note}
        />

        <div className="space-y-2">
          <span className="text-sm font-medium text-dusk">Who is splitting this?</span>
          <div className="flex flex-wrap gap-2 rounded-[1.5rem] border border-ink/10 bg-white/70 p-3">
            {members.map((member) => {
              const active = selectedMemberIds.includes(member.uid)
              return (
                <button
                  key={member.uid}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-ink text-white' : 'bg-sand text-dusk'
                  }`}
                  onClick={() => toggleMember(member.uid)}
                  type="button"
                >
                  <Avatar label={`${member.name || 'Member'} avatar`} name={member.name} size="xs" src={member.photoURL} uid={member.uid} />
                  {member.name || 'Member'}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-medium text-dusk">Split mode</span>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SPLIT_MODES.map((mode) => (
              <button
                key={mode.value}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                  form.splitMode === mode.value
                    ? 'border-teal bg-teal/10'
                    : 'border-ink/10 bg-white/65 hover:bg-white'
                }`}
                onClick={() => setForm((current) => ({ ...current, splitMode: mode.value }))}
                type="button"
              >
                <p className="font-semibold text-ink">{mode.label}</p>
                <p className="mt-1 text-sm text-dusk/65">{mode.helper}</p>
              </button>
            ))}
          </div>
        </div>

        {form.splitMode !== 'equal' ? (
          <div className="grid gap-3 rounded-[1.75rem] border border-ink/10 bg-white/65 p-4 sm:grid-cols-2">
            {members
              .filter((member) => selectedMemberIds.includes(member.uid))
              .map((member) => (
                <Input
                  key={member.uid}
                  label={`${member.name} ${
                    form.splitMode === 'percentage'
                      ? '(%)'
                      : form.splitMode === 'shares'
                        ? '(shares)'
                        : `(${currency})`
                  }`}
                  min="0"
                  onChange={(event) =>
                    setSplitValues((current) => ({
                      ...current,
                      [member.uid]: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={splitValues[member.uid] || ''}
                />
              ))}
          </div>
        ) : null}

        <ReceiptScanButton
          onResult={(parsed) => {
            setForm((current) => ({
              ...current,
              amount: parsed.amount || current.amount,
              title: current.title || parsed.title,
            }))
          }}
        />

        <div className="rounded-[1.75rem] border border-dashed border-ink/10 bg-sand/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-dusk">
            <Link2 className="h-4 w-4" />
            Receipt link
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end">
            <Input
              hint="Upload the image to Google Drive, share it with the trip, then paste the link here."
              name="receiptURL"
              onChange={handleChange}
              placeholder="https://drive.google.com/file/d/..."
              type="url"
              value={form.receiptURL}
            />
            {form.receiptURL ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-full bg-white/80 px-5 text-sm font-medium text-ink ring-1 ring-ink/10 transition hover:bg-white"
                href={form.receiptURL}
                rel="noreferrer"
                target="_blank"
              >
                Open receipt
              </a>
            ) : null}
          </div>
        </div>

        {previewSplit.length ? (
          <div className="rounded-[1.75rem] border border-ink/10 bg-white/65 p-4">
            <p className="text-sm font-medium text-dusk">Preview</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {previewSplit.map((item) => (
                <div
                  key={item.uid}
                  className="rounded-full bg-ink/5 px-3 py-2 text-sm text-dusk"
                >
                  {getDisplayName(members.find((member) => member.uid === item.uid))}:{' '}
                  <span className="font-semibold text-ink">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button loading={loading} type="submit">
            {initialExpense?.id ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
