import { useMemo, useState } from 'react'
import { CircleCheck, Clock, IndianRupee, ShieldCheck, WalletCards } from 'lucide-react'

import { advanceStatusForMember } from '../../lib/advances'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { fromMinorUnits, toMinorUnits } from '../../lib/money'
import { MemberAvatar } from '../ui/MemberAvatar'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { DatePicker } from '../ui/DatePicker'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

const today = () => new Date().toISOString().slice(0, 10)

const statusTone = {
  none: 'text-dusk',
  partial: 'text-amber-700',
  covered: 'text-emerald-700',
  credit: 'text-teal',
}

export const AdvanceContributions = ({
  trip,
  members = [],
  balances = [],
  advances = [],
  canManage = false,
  saving = false,
  onRecord,
  onReverse,
}) => {
  const currency = trip?.currency || 'INR'
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ memberUid: '', amount: '', paymentDate: today(), reference: '', note: '' })
  const [formError, setFormError] = useState('')
  const activeMembers = members.filter((member) => trip?.memberIds?.includes(member.uid))
  const balanceByUid = useMemo(() => Object.fromEntries(balances.map((entry) => [entry.uid, entry])), [balances])
  const historyByUid = useMemo(() => {
    const grouped = new Map()
    advances.forEach((entry) => {
      const list = grouped.get(entry.memberUid) || []
      list.push(entry)
      grouped.set(entry.memberUid, list)
    })
    return grouped
  }, [advances])
  const contributedMembers = activeMembers.filter((member) => (balanceByUid[member.uid]?.advance || 0) > 0)

  const submit = async (event) => {
    event.preventDefault()
    setFormError('')
    try {
      await onRecord?.(form)
      setForm({ memberUid: '', amount: '', paymentDate: today(), reference: '', note: '' })
      setOpen(false)
    } catch (error) {
      setFormError(error?.message || 'The advance contribution was not recorded.')
    }
  }

  return (
    <section className="min-w-0 space-y-4" aria-label="Advance contributions">
      <Card className="min-w-0">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <WalletCards aria-hidden="true" className="h-5 w-5 text-teal" />
              <h2 className="font-display text-lg font-semibold text-ink">Advance contributions</h2>
            </div>
            <p className="mt-1 text-sm leading-5 text-dusk">Money collected before expenses are settled. These payments are not trip expenses.</p>
          </div>
          {canManage ? (
            <Button className="min-h-11 shrink-0" onClick={() => { setFormError(''); setOpen(true) }} type="button">
              <IndianRupee aria-hidden="true" className="h-4 w-4" /> Add Advance
            </Button>
          ) : (
            <p className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-50 px-3 text-sm text-dusk">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" /> Only a trip admin can record advances.
            </p>
          )}
        </div>
        <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
          <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-xs text-dusk">Total advance collected</p>
            <p className="mt-1 break-words font-display text-xl font-bold text-ink">{formatCurrency(balances.reduce((sum, entry) => sum + (trip?.memberIds?.includes(entry.uid) ? entry.advance || 0 : 0), 0), currency)}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-xs text-dusk">Members who contributed</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{contributedMembers.length}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-xs text-dusk">No advance yet</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{Math.max(0, activeMembers.length - contributedMembers.length)}</p>
          </div>
        </div>
      </Card>

      {activeMembers.length ? (
        <div className="grid min-w-0 gap-3">
          {activeMembers.map((member) => {
            const balance = balanceByUid[member.uid]
            const advancePaise = toMinorUnits(balance?.advance || 0, currency)
            const sharePaise = toMinorUnits(balance?.share || 0, currency)
            const status = advanceStatusForMember({ advancePaise, sharePaise })
            const history = [...(historyByUid.get(member.uid) || [])].sort((first, second) => String(second.paymentDate || '').localeCompare(String(first.paymentDate || '')))
            return (
              <Card className="min-w-0 p-4" key={member.uid}>
                <div className="flex min-w-0 items-start gap-3">
                  <MemberAvatar label={`${member.name || 'Member'} profile photo`} member={member} name={member.name} size="sm" src={member.photoURL} uid={member.uid} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-ink [overflow-wrap:anywhere]">{member.name || 'Traveler'}</p>
                    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${statusTone[status.id] || 'text-dusk'}`}>
                      {status.id === 'none' ? <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <CircleCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                      <span className="break-words [overflow-wrap:anywhere]">{status.id === 'none' ? status.label : `Advance paid · ${status.label}`}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-bold text-ink">{formatCurrency(balance?.advance || 0, currency)}</p>
                    <p className="text-[11px] text-dusk">Remaining {formatCurrency(balance?.remainingContribution || 0, currency)}</p>
                  </div>
                </div>
                {history.length ? (
                  <ul className="mt-3 space-y-2">
                    {history.map((entry) => (
                      <li className="flex min-w-0 flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between" key={entry.id}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{entry.status === 'reversal' ? 'Correction' : 'Advance paid'} · {formatCurrency(fromMinorUnits(entry.amountPaise || 0, currency), currency)}</p>
                          <p className="break-words text-xs text-dusk [overflow-wrap:anywhere]">{formatDate(entry.paymentDate)}{entry.reference ? ` · ${entry.reference}` : ''}{entry.note ? ` · ${entry.note}` : ''}</p>
                        </div>
                        {canManage && entry.status === 'recorded' ? (
                          <Button className="min-h-11 shrink-0" disabled={saving} onClick={() => onReverse?.(entry)} size="sm" type="button" variant="secondary">Correct</Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState description="Add travelers to this trip before recording advance contributions." icon={WalletCards} title="No members yet" />
      )}

      <Modal description="Record money a member has already contributed toward this trip." onClose={() => setOpen(false)} open={open} title="Add advance">
        <form className="space-y-4" onSubmit={submit}>
          <Select
            label="Trip member"
            onChange={(event) => setForm((current) => ({ ...current, memberUid: event.target.value }))}
            options={[{ value: '', label: 'Select a member' }, ...activeMembers.map((member) => ({ value: member.uid, label: member.name || 'Traveler' }))]}
            value={form.memberUid}
          />
          <Input inputMode="decimal" label={currency === 'INR' ? 'Amount (₹)' : `Amount (${currency})`} min="0" onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" step="0.01" type="number" value={form.amount} />
          <DatePicker label="Payment date" name="paymentDate" onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} required value={form.paymentDate} />
          <Input label="Payment reference" maxLength={80} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Optional UPI or receipt reference" value={form.reference} />
          <Input label="Note" maxLength={280} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" value={form.note} />
          <p className="inline-flex items-start gap-1.5 text-xs leading-5 text-dusk"><ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Only the trip admin can add or correct an advance. This does not create an expense.</p>
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
          <Button className="min-h-11 w-full" loading={saving} type="submit">Save advance</Button>
        </form>
      </Modal>
    </section>
  )
}
