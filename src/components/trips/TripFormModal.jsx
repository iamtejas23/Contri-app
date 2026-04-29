import { useState } from 'react'

import { CURRENCIES, DEFAULT_TRIP_FORM, TRIP_EMOJIS } from '../../lib/constants'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

const buildTripFormState = (values) => ({
  ...DEFAULT_TRIP_FORM,
  name: values?.name || '',
  description: values?.description || '',
  emoji: values?.emoji || DEFAULT_TRIP_FORM.emoji,
  startDate: values?.startDate || '',
  endDate: values?.endDate || '',
  currency: values?.currency || DEFAULT_TRIP_FORM.currency,
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
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
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
          <Input
            label="Start date"
            name="startDate"
            onChange={handleChange}
            required
            type="date"
            value={form.startDate}
          />
          <Input
            label="End date"
            name="endDate"
            onChange={handleChange}
            required
            type="date"
            value={form.endDate}
          />
        </div>

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
            <span className="text-sm font-medium text-dusk">Cover emoji</span>
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
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
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
