import { ArrowRight, CalendarDays, Users } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router-dom'

import { formatDate } from '../../lib/date'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'

const getTripStatus = (startDate, endDate) => {
  const today = new Date().toISOString().slice(0, 10)
  if (!startDate || !endDate) return null
  if (today < startDate) return { label: 'Upcoming', tone: 'blue' }
  if (today > endDate)   return { label: 'Ended',    tone: 'default' }
  return { label: 'Active', tone: 'green' }
}

const TripCardComponent = ({ trip, currentUser }) => {
  const status = getTripStatus(trip.startDate, trip.endDate)
  const members = (trip.members || []).map((member) => member.uid === currentUser?.uid
    ? {
        ...member,
        name: currentUser.name || member.name,
        photoURL: currentUser.photoURL || member.photoURL || '',
      }
    : member)

  return (
    <Link className="group block h-full" to={`/trips/${trip.id}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            {trip.emoji === 'shivneri-fort' ? (
              <img alt="Shivneri Fort" className="h-8 w-8 object-contain" src="/shivneri-fort.png" />
            ) : (
              <span className="text-2xl">{trip.emoji || '🏝️'}</span>
            )}
            <div className="flex flex-wrap gap-1.5">
              {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
              <Badge>{trip.currency === 'INR' ? '₹ INR' : trip.currency}</Badge>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-semibold text-ink line-clamp-1">{trip.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-dusk">
            {trip.description || 'Petrol, toll, food, hotel — one hisab for the whole group.'}
          </p>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span aria-label={`${members.length} trip members`} className="inline-flex min-w-0 items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-dusk" role="group">
              {members.length ? (
                <span className="flex flex-shrink-0 items-center -space-x-2">
                  {members.slice(0, 3).map((member) => (
                    <Avatar key={member.uid} className="h-6 w-6 text-[9px]" label={`${member.name || 'Member'} avatar`} name={member.name} size="xs" src={member.photoURL} uid={member.uid} />
                  ))}
                  {members.length > 3 ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-dusk ring-2 ring-sand">+{members.length - 3}</span> : null}
                </span>
              ) : <Users className="h-3.5 w-3.5" />}
              <span className="truncate">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-dusk">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(trip.startDate, 'dd MMM')} – {formatDate(trip.endDate, 'dd MMM yy')}
            </span>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-slate-100 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            {trip.budget ? (
              <span className="text-xs font-medium text-dusk">Budget set</span>
            ) : (
              <span className="text-xs font-medium text-dusk">Open hisab</span>
            )}
            <span className="text-sm font-semibold text-teal group-hover:underline">
              Open →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export const TripCard = memo(TripCardComponent)
