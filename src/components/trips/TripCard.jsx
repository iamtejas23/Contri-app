import { CalendarDays, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDate } from '../../lib/date'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

export const TripCard = ({ trip }) => (
  <Card className="group h-full transition hover:-translate-y-1">
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-4xl">{trip.emoji || '🏝️'}</span>
        <h3 className="mt-4 font-display text-2xl font-bold text-ink">{trip.name}</h3>
      </div>
      <Badge>{trip.currency}</Badge>
    </div>

    <p className="mt-3 line-clamp-2 text-sm text-dusk/70">
      {trip.description || 'A shared trip board for plans, bills, and settlements.'}
    </p>

    <div className="mt-5 flex flex-wrap gap-3 text-sm text-dusk/75">
      <span className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-2">
        <Users className="h-4 w-4" />
        {trip.members?.length || 0} members
      </span>
      <span className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-2">
        <CalendarDays className="h-4 w-4" />
        {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
      </span>
    </div>

    <Link
      className="mt-6 inline-flex items-center rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition group-hover:bg-dusk"
      to={`/trips/${trip.id}`}
    >
      Open trip
    </Link>
  </Card>
)
