import { ArrowRight, CalendarDays } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router-dom'

import { formatDate } from '../../lib/date'
import { Badge } from '../ui/Badge'
import { TripMembersIndicator } from './TripMembersIndicator'

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
    <article className="group h-full">
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
          <Link aria-label={`Open ${trip.name}`} className="rounded-full p-2 text-slate-300 transition hover:bg-white hover:text-teal focus-visible:outline-teal" to={`/trips/${trip.id}`}>
            <ArrowRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-semibold text-ink line-clamp-1">
            <Link className="rounded-sm focus-visible:outline-teal" to={`/trips/${trip.id}`}>{trip.name}</Link>
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-dusk">
            {trip.description || 'Petrol, toll, food, hotel — one hisab for the whole group.'}
          </p>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-2">
            <TripMembersIndicator className="bg-slate-100" members={members} maxVisible={3} size="compact" />
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
            <Link className="text-sm font-semibold text-teal group-hover:underline" to={`/trips/${trip.id}`}>Open →</Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export const TripCard = memo(TripCardComponent)
