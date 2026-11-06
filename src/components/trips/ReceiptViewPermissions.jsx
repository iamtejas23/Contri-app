import { CheckCircle2, Receipt, Shield } from 'lucide-react'

import { getReceiptViewStatus } from '../../lib/tripGroupPresentation'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { MemberAvatar } from '../ui/MemberAvatar'

export const ReceiptViewPermissions = ({
  trip,
  members = [],
  viewerIds = [],
  canManage = false,
  savingUid = '',
  onToggle,
}) => (
  <Card className="p-4 sm:p-5">
    <div className="flex min-w-0 items-start gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
        <Receipt aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold leading-tight text-ink">Receipt viewing permissions</h2>
        <p className="mt-1 text-sm leading-5 text-dusk">Choose which members can open receipt images. This does not allow them to upload receipts.</p>
      </div>
    </div>
    <ul className="mt-4 space-y-2">
      {members.map((member) => {
        const status = getReceiptViewStatus({ member, trip, viewerIds })
        const isSaving = savingUid === member.uid
        return (
          <li className="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" key={member.uid}>
            <div className="flex min-w-0 items-center gap-3">
              <MemberAvatar member={member} name={member.name} size="sm" src={member.photoURL} uid={member.uid} />
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{member.name || 'Traveler'}</p>
                <p className={`mt-1 inline-flex max-w-full items-center gap-1 text-xs font-medium ${status.enabled ? 'text-emerald-700' : 'text-dusk'}`}>
                  {status.enabled ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <Shield aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                  <span className="break-words [overflow-wrap:anywhere]">{status.label}</span>
                </p>
                <p className="mt-0.5 break-words text-xs text-dusk [overflow-wrap:anywhere]">{status.detail}</p>
              </div>
            </div>
            {canManage && !status.isAdmin && !member.isGuest ? (
              <Button
                className="min-h-11 shrink-0"
                disabled={Boolean(savingUid)}
                loading={isSaving}
                onClick={() => onToggle?.(member)}
                size="sm"
                type="button"
                variant={status.enabled ? 'secondary' : 'primary'}
              >
                {status.enabled ? 'Revoke access' : 'Grant access'}
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
    {!canManage ? (
      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-dusk">Only a trip admin can change who can view receipts.</p>
    ) : null}
  </Card>
)
