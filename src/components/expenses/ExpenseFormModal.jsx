import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link2 } from 'lucide-react'

import {
  DEFAULT_EXPENSE_FORM,
  EXPENSE_CATEGORIES,
  SPLIT_MODES,
} from '../../lib/constants'
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
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
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
      title={initialExpense ? 'Edit expense' : 'Add expense'}
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Category"
            name="category"
            onChange={handleChange}
            options={EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))}
            value={form.category}
          />
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
          <Input
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
            type="date"
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
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-ink text-white' : 'bg-sand text-dusk'
                  }`}
                  onClick={() => toggleMember(member.uid)}
                  type="button"
                >
                  {member.name}
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

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button loading={loading} type="submit">
            {initialExpense ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
