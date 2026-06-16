import { ArrowRight, CalendarDays, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDate } from '../../lib/date'
import { Badge } from '../ui/Badge'

const getTripStatus = (startDate, endDate) => {
  const today = new Date().toISOString().slice(0, 10)
  if (!startDate || !endDate) return null
  if (today < startDate) return { label: 'Upcoming', tone: 'blue' }
  if (today > endDate)   return { label: 'Ended',    tone: 'default' }
  return { label: 'Active', tone: 'green' }
}

export const TripCard = ({ trip }) => {
  const status = getTripStatus(trip.startDate, trip.endDate)

  return (
    <Link className="group block h-full" to={`/trips/${trip.id}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{trip.emoji || '🏝️'}</span>
            <div className="flex flex-wrap gap-1.5">
              {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
              <Badge>{trip.currency}</Badge>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-semibold text-ink line-clamp-1">{trip.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-dusk">
            {trip.description || 'A shared trip board for plans, bills, and settlements.'}
          </p>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-dusk">
              <Users className="h-3.5 w-3.5" />
              {trip.members?.length || 0}{' '}
              {trip.members?.length === 1 ? 'member' : 'members'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-dusk">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(trip.startDate, 'dd MMM')} – {formatDate(trip.endDate, 'dd MMM yy')}
            </span>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-slate-100 px-5 py-3">
          <span className="text-sm font-semibold text-teal group-hover:underline">
            View trip →
          </span>
        </div>
      </div>
    </Link>
  )
}
