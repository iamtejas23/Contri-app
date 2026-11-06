import { Crown, Shield, ShieldCheck, User, Users } from 'lucide-react'

import { formatCurrency } from '../../lib/currency'
import { getMemberGroupRoles } from '../../lib/tripGroupPresentation'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { MemberAvatar } from '../ui/MemberAvatar'

const RoleChip = ({ role }) => {
  const icon = role.id === 'creator'
    ? <Crown aria-hidden="true" className="h-3.5 w-3.5" />
    : role.id === 'admin'
      ? <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
      : role.id === 'settlement'
        ? <Shield aria-hidden="true" className="h-3.5 w-3.5" />
        : <User aria-hidden="true" className="h-3.5 w-3.5" />
  const tone = role.id === 'member'
    ? 'bg-slate-100 text-dusk'
    : role.id === 'settlement'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-teal/10 text-teal'
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold leading-none ${tone}`}>
      {icon}
      <span className="truncate">{role.label}</span>
    </span>
  )
}

export const TripMembersSection = ({
  trip,
  members = [],
  currency,
  balances = [],
  canManage = false,
  settlementManagerIds = [],
  onRoleChange,
}) => {
  const count = members.length
  const preview = members.slice(0, 6)
  const extra = Math.max(0, count - preview.length)

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
              <Users aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold leading-tight text-ink">Group</h2>
              <p className="text-sm text-dusk">{count} {count === 1 ? 'member' : 'members'}</p>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="hidden shrink-0 items-center pl-1 sm:flex">
          {preview.map((member, index) => (
            <span className={index === 0 ? '' : '-ml-2'} key={member.uid} style={{ zIndex: preview.length - index }}>
              <Avatar name={member.name || 'Traveler'} size="sm" src={member.photoURL} uid={member.uid} />
            </span>
          ))}
          {extra ? (
            <span className="-ml-2 flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-dusk ring-2 ring-white">
              +{extra}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {members.map((member) => {
          const finances = balances.find((entry) => entry.uid === member.uid)
          const presentation = getMemberGroupRoles(member, trip, settlementManagerIds)
          const name = member.name || 'Traveler'
          return (
            <li
              className={`flex min-w-0 flex-col gap-2 rounded-2xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${presentation.isCreator ? 'border-teal/30 bg-teal/[0.06]' : 'border-slate-200 bg-slate-50'}`}
              key={member.uid}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <MemberAvatar member={member} name={name} size="sm" src={member.photoURL} uid={member.uid} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-5 text-ink [overflow-wrap:anywhere]" title={name}>{name}</p>
                  <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                    {presentation.roles.map((role) => <RoleChip key={role.id} role={role} />)}
                    {member.isGuest ? <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">Guest</span> : null}
                  </div>
                  <p className="mt-1.5 break-words text-xs leading-5 text-dusk [overflow-wrap:anywhere]">
                    Paid {formatCurrency(finances?.paid || 0, currency)}
                    <span aria-hidden="true"> · </span>
                    Share {formatCurrency(finances?.share || 0, currency)}
                    <span aria-hidden="true"> · </span>
                    Net {formatCurrency(finances?.net || 0, currency)}
                  </p>
                </div>
              </div>
              {canManage ? (
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {presentation.isAdmin ? (
                    <Button
                      className="min-h-11"
                      disabled={(trip.adminIds?.length || 0) <= 1}
                      onClick={() => onRoleChange?.(member, 'member')}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Demote
                    </Button>
                  ) : (
                    <Button className="min-h-11" onClick={() => onRoleChange?.(member, 'admin')} size="sm" type="button" variant="secondary">
                      <ShieldCheck className="h-4 w-4" />
                      Make admin
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
