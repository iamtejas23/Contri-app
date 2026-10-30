import { useState } from 'react'
import toast from 'react-hot-toast'

import { CURRENCIES, DEFAULT_TRIP_FORM, TRIP_EMOJIS } from '../../lib/constants'
import { isDateAfter, isDateBefore } from '../../lib/date'
import { roundCurrency, toNumber } from '../../lib/utils'
import { Button } from '../ui/Button'
import { DatePicker } from '../ui/DatePicker'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

const SHIVNERI_FORT_COVER = 'shivneri-fort'

const buildTripFormState = (values) => ({
  ...DEFAULT_TRIP_FORM,
  name: values?.name || '',
  description: values?.description || '',
  emoji: values?.emoji || DEFAULT_TRIP_FORM.emoji,
  startDate: values?.startDate || '',
  endDate: values?.endDate || '',
  currency: values?.currency || DEFAULT_TRIP_FORM.currency,
  budget: values?.budget ? String(values.budget) : '',
})

export const TripFormModal = ({
  open,
  onClose,
  onSubmit,
  initialValues = DEFAULT_TRIP_FORM,
  title,
  submitLabel,
}) => {
  const [form, setForm] = useState(() => buildTripFormState(initialValues))
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => {
      if (name === 'startDate') {
        return {
          ...current,
          startDate: value,
          endDate: current.endDate && isDateBefore(current.endDate, value) ? value : current.endDate,
        }
      }

      return { ...current, [name]: value }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    if (!form.startDate || !form.endDate) {
      toast.error('Choose both trip dates.')
      return
    }

    if (isDateAfter(form.startDate, form.endDate)) {
      toast.error('End date must be the same day or after the start date.')
      return
    }

    setLoading(true)

    try {
      const budgetValue = String(form.budget).trim()

      await onSubmit({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        budget: budgetValue ? roundCurrency(toNumber(budgetValue)) : null,
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
      description="Shape the basics now. Everything else stays live and editable."
      onClose={onClose}
      open={open}
      title={title}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <Input
          label="Trip name"
          name="name"
          onChange={handleChange}
          placeholder="Goa long weekend"
          required
          value={form.name}
        />

        <Textarea
          label="Description"
          name="description"
          onChange={handleChange}
          placeholder="Who is coming, what is the vibe, and what are we planning?"
          value={form.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            hint="Changing this updates the earliest allowed end date."
            label="Start date"
            name="startDate"
            onChange={handleChange}
            required
            value={form.startDate}
          />
          <DatePicker
            hint="End date cannot be before the start date."
            label="End date"
            min={form.startDate || undefined}
            name="endDate"
            onChange={handleChange}
            required
            value={form.endDate}
          />
        </div>

        <Input
          hint="Optional. We’ll show how much of the trip budget is left."
          label="Trip budget"
          min="0"
          name="budget"
          onChange={handleChange}
          placeholder="20000"
          step="1"
          type="number"
          value={form.budget}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Currency"
            name="currency"
            onChange={handleChange}
            options={CURRENCIES.map((item) => ({
              value: item.code,
              label: `${item.code} · ${item.label}`,
            }))}
            value={form.currency}
          />

          <div className="space-y-2">
            <span className="text-sm font-medium text-dusk">Cover icon</span>
            <div className="grid grid-cols-6 gap-2 rounded-[1.5rem] border border-ink/10 bg-white/70 p-3">
              {TRIP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className={`rounded-2xl px-3 py-3 text-2xl transition ${
                    form.emoji === emoji ? 'bg-ink/10 ring-2 ring-teal' : 'hover:bg-sand'
                  }`}
                  onClick={() => setForm((current) => ({ ...current, emoji }))}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
              <button
                aria-label="Shivneri Fort"
                className={`flex items-center justify-center rounded-2xl p-2 transition ${
                  form.emoji === SHIVNERI_FORT_COVER ? 'bg-ink/10 ring-2 ring-teal' : 'hover:bg-sand'
                }`}
                onClick={() => setForm((current) => ({ ...current, emoji: SHIVNERI_FORT_COVER }))}
                title="Shivneri Fort"
                type="button"
              >
                <img alt="" className="h-9 w-9 object-contain" src="/shivneri-fort.png" />
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button loading={loading} type="submit">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
