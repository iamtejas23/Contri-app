import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { useUserTrips } from '../hooks/useUserTrips'
import { DEFAULT_TRIP_FORM } from '../lib/constants'
import { getDisplayName } from '../lib/utils'
import { createTrip } from '../services/trips'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { TripCard } from '../components/trips/TripCard'
import { TripFormModal } from '../components/trips/TripFormModal'

export const HomePage = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { trips, loading } = useUserTrips(user?.uid)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const stats = useMemo(
    () => ({
      tripCount: trips.length,
      memberCount: trips.reduce((sum, trip) => sum + (trip.members?.length || 0), 0),
    }),
    [trips],
  )

  const actor = {
    uid: user?.uid,
    name: getDisplayName(profile || user),
    email: profile?.email || user?.email || '',
  }

  const handleCreateTrip = async (values) => {
    const tripId = await createTrip({ values, actor })
    toast.success('Trip created.')
    navigate(`/trips/${tripId}`)
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-gradient-to-br from-cream to-white/85 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-dusk/55">
              Welcome back
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
              Keep every shared trip fair, clear, and low-drama.
            </h1>
            <p className="mt-4 text-base text-dusk/72">
              Build a trip board for {getDisplayName(profile || user)}, bring in the crew,
              and let the live dashboard keep the math from turning into group chat chaos.
            </p>
          </div>

          <Button onClick={() => setShowCreateModal(true)} size="lg" type="button">
            <Plus className="h-5 w-5" />
            Create trip
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[1.75rem] bg-sand/75 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk/55">
              Active trips
            </p>
            <p className="mt-3 font-display text-4xl font-bold text-ink">{stats.tripCount}</p>
          </div>
          <div className="rounded-[1.75rem] bg-sand/75 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk/55">
              Total travelers
            </p>
            <p className="mt-3 font-display text-4xl font-bold text-ink">{stats.memberCount}</p>
          </div>
          <div className="rounded-[1.75rem] bg-sand/75 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk/55">
              Best use
            </p>
            <p className="mt-3 text-sm leading-6 text-dusk/72">
              Weekend getaways, group stays, road trips, destination weddings, and any
              itinerary where shared costs pile up fast.
            </p>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Your trips</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">
              Pick up where the last receipt left off
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-[2rem]" />
            ))}
          </div>
        ) : trips.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <EmptyState
            actionLabel="Create your first trip"
            description="Start with a destination, invite the group, and add the first shared cost when it happens."
            onAction={() => setShowCreateModal(true)}
            title="No trips yet"
          />
        )}
      </section>

      {showCreateModal ? (
        <TripFormModal
          initialValues={DEFAULT_TRIP_FORM}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTrip}
          open={showCreateModal}
          submitLabel="Create trip"
          title="Create a new trip"
        />
      ) : null}
    </div>
  )
}
