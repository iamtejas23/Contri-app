import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, Clock, EllipsisVertical, IndianRupee, PencilLine, ShieldCheck, Trash2, WalletCards } from 'lucide-react'

import { advanceStatusForMember, isActiveRecordedAdvance } from '../../lib/advances'
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

const emptyForm = () => ({ memberUid: '', amount: '', paymentDate: today(), reference: '', note: '' })

const historyLabel = (entry) => {
  if (entry.status === 'reversal') return 'Reversal'
  if (entry.status === 'reversed') return 'Advance paid (reversed)'
  if (entry.replaces) return 'Corrected advance'
  return 'Advance paid'
}

const AdvanceFormFields = ({ value, onChange, activeMembers, currency }) => (
  <>
    <Select
      label="Trip member"
      onChange={(event) => onChange((current) => ({ ...current, memberUid: event.target.value }))}
      options={[{ value: '', label: 'Select a member' }, ...activeMembers.map((member) => ({ value: member.uid, label: member.name || 'Traveler' }))]}
      value={value.memberUid}
    />
    <Input inputMode="decimal" label={currency === 'INR' ? 'Amount (₹)' : `Amount (${currency})`} min="0" onChange={(event) => onChange((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" step="0.01" type="number" value={value.amount} />
    <DatePicker label="Payment date" name="paymentDate" onChange={(event) => onChange((current) => ({ ...current, paymentDate: event.target.value }))} required value={value.paymentDate} />
    <Input label="Payment reference" maxLength={80} onChange={(event) => onChange((current) => ({ ...current, reference: event.target.value }))} placeholder="Optional UPI or receipt reference" value={value.reference} />
    <Input label="Note" maxLength={280} onChange={(event) => onChange((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" value={value.note} />
  </>
)

export const AdvanceContributions = ({
  trip,
  members = [],
  balances = [],
  advances = [],
  canManage = false,
  saving = false,
  onRecord,
  onReplace,
  onReverse,
}) => {
  const currency = trip?.currency || 'INR'
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [menuId, setMenuId] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editError, setEditError] = useState('')
  const [deleting, setDeleting] = useState(null)
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
  const memberName = (uid) => activeMembers.find((member) => member.uid === uid)?.name || members.find((member) => member.uid === uid)?.name || 'Traveler'

  useEffect(() => {
    if (!menuId) return undefined
    const close = () => setMenuId('')
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuId])

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setFormError('')
    try {
      await onRecord?.(form)
      setForm(emptyForm())
      setOpen(false)
    } catch (error) {
      setFormError(error?.message || 'The advance contribution was not recorded.')
    }
  }

  const submitEdit = async (event) => {
    event.preventDefault()
    if (saving || !editing) return
    setEditError('')
    try {
      await onReplace?.(editing, editForm)
      setEditing(null)
    } catch (error) {
      setEditError(error?.message || 'The advance contribution was not updated.')
    }
  }

  const confirmDelete = async () => {
    if (saving || !deleting) return
    try {
      await onReverse?.(deleting, { note: 'Deleted by trip admin' })
      setDeleting(null)
    } catch {
      /* parent toasts */
    }
  }

  const openEdit = (entry) => {
    setMenuId('')
    setEditError('')
    setEditing(entry)
    setEditForm({
      memberUid: entry.memberUid,
      amount: String(fromMinorUnits(entry.amountPaise || 0, currency)),
      paymentDate: entry.paymentDate || today(),
      reference: entry.reference || '',
      note: entry.note || '',
    })
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
                      <li className="flex min-w-0 items-start gap-2 rounded-xl bg-slate-50 px-3 py-2" key={entry.id}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{historyLabel(entry)} · {formatCurrency(fromMinorUnits(entry.amountPaise || 0, currency), currency)}</p>
                          <p className="break-words text-xs text-dusk [overflow-wrap:anywhere]">{formatDate(entry.paymentDate)}{entry.reference ? ` · ${entry.reference}` : ''}{entry.note ? ` · ${entry.note}` : ''}</p>
                        </div>
                        {canManage && isActiveRecordedAdvance(entry, advances) ? (
                          <div className="relative shrink-0">
                            <button
                              aria-haspopup="menu"
                              aria-label="Advance actions"
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-dusk transition hover:bg-white hover:text-ink"
                              disabled={saving}
                              onClick={(event) => {
                                event.stopPropagation()
                                setMenuId((current) => current === entry.id ? '' : entry.id)
                              }}
                              type="button"
                            >
                              <EllipsisVertical aria-hidden="true" className="h-4 w-4" />
                            </button>
                            {menuId === entry.id ? (
                              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg" role="menu">
                                <button className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-ink hover:bg-slate-50" onClick={() => openEdit(entry)} role="menuitem" type="button">
                                  <PencilLine aria-hidden="true" className="h-4 w-4" /> Edit Advance
                                </button>
                                <button className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { setMenuId(''); setDeleting(entry) }} role="menuitem" type="button">
                                  <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete Advance
                                </button>
                              </div>
                            ) : null}
                          </div>
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
          <AdvanceFormFields activeMembers={activeMembers} currency={currency} onChange={setForm} value={form} />
          <p className="inline-flex items-start gap-1.5 text-xs leading-5 text-dusk"><ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Only the trip admin can add or correct an advance. This does not create an expense.</p>
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
          <Button className="min-h-11 w-full" disabled={saving} loading={saving} type="submit">Save advance</Button>
        </form>
      </Modal>

      <Modal description="The original payment stays in history. A reversal and a replacement record are created together." onClose={() => !saving && setEditing(null)} open={Boolean(editing)} title="Edit advance">
        <form className="space-y-4" onSubmit={submitEdit}>
          <AdvanceFormFields activeMembers={activeMembers} currency={currency} onChange={setEditForm} value={editForm} />
          {editError ? <p className="text-sm text-red-600" role="alert">{editError}</p> : null}
          <Button className="min-h-11 w-full" disabled={saving} loading={saving} type="submit">Save correction</Button>
        </form>
      </Modal>

      <Modal description="This keeps a complete payment history." onClose={() => !saving && setDeleting(null)} open={Boolean(deleting)} size="compact" title="Delete advance?">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-dusk">
            Reverse the advance of <strong className="text-ink">{formatCurrency(fromMinorUnits(deleting?.amountPaise || 0, currency), currency)}</strong> for <strong className="text-ink">{memberName(deleting?.memberUid)}</strong>?
          </p>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">A reversal entry is added. The original amount is not physically deleted and will no longer count toward balances.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={saving} onClick={() => setDeleting(null)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={saving} loading={saving} onClick={confirmDelete} type="button" variant="danger">
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Reverse advance
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
