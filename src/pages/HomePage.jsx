import { Link2, Map, Plus, Search, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { ErrorState } from '../components/ui/ErrorState'
import { useAuth } from '../context/useAuth'
import { useUserTrips } from '../hooks/useUserTrips'
import { DEFAULT_TRIP_FORM } from '../lib/constants'
import { buildActor, getDisplayName } from '../lib/utils'
import { createTrip } from '../services/trips'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { TripCard } from '../components/trips/TripCard'
import { TripFormModal } from '../components/trips/TripFormModal'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { getTripIdFromInvite } from '../lib/invites'

export const HomePage = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { trips, loading, error, retry } = useUserTrips(user?.uid)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [inviteValue, setInviteValue] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [search, setSearch] = useState('')

  const stats = useMemo(() => ({
    tripCount: trips.length,
    memberCount: trips.reduce((sum, t) => sum + (t.members?.length || 0), 0),
  }), [trips])

  const filtered = useMemo(() => {
    if (!search.trim()) return trips
    const q = search.toLowerCase()
    return trips.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q),
    )
  }, [trips, search])

  const actor = buildActor(user, profile)

  const handleCreateTrip = async (values) => {
    const tripId = await createTrip({ values, actor })
    toast.success('Trip created.')
    navigate(`/trips/${tripId}`)
  }

  const handleJoinTrip = (event) => {
    event.preventDefault()
    const tripId = getTripIdFromInvite(inviteValue)
    if (!tripId) {
      setInviteError('Enter a valid Contri invite link or trip code.')
      return
    }
    navigate(`/join?tripId=${encodeURIComponent(tripId)}`)
  }

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal via-teal/90 to-teal/70">
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Welcome back, {getDisplayName(profile || user)}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
            Trip khatam.<br className="hidden sm:block" /> Hisab bhi khatam.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/70">
            Log petrol, toll, food, and hotel as they happen. See who owes whom,
            pay with UPI, and send the hisab on WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="bg-white text-teal hover:bg-slate-50"
              onClick={() => setShowCreateModal(true)}
              size="lg"
              type="button"
              variant="white"
            >
              <Plus className="h-4 w-4" />
              Create trip
            </Button>
            <Button
              className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setShowJoinModal(true)}
              size="lg"
              type="button"
              variant="ghost"
            >
              <Link2 className="h-4 w-4" />
              Join Trip
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 divide-x divide-white/20 border-t border-white/20 sm:grid-cols-3">
          <div className="flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-6">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Map className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/55">Trips</p>
              <p className="font-display text-2xl font-bold text-white">{stats.tripCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-6">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/55">Travelers</p>
              <p className="font-display text-2xl font-bold text-white">{stats.memberCount}</p>
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2 px-3 py-4 sm:col-span-1 sm:gap-3 sm:px-6">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/55">Settle in</p>
              <p className="text-sm font-medium text-white/85">₹ + UPI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trips section */}
      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Your trips</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              Open a hisab
            </h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {trips.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/15 sm:w-52"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trips…"
                  aria-label="Search trips"
                  type="search"
                  value={search}
                />
              </div>
            )}
            <Button onClick={() => setShowJoinModal(true)} size="sm" type="button" variant="secondary">
              <Link2 className="h-4 w-4" />
              Join Trip
            </Button>
            <Button onClick={() => setShowCreateModal(true)} size="sm" type="button">
              <Plus className="h-4 w-4" />
              New trip
            </Button>
          </div>
        </div>

        {error && !loading && trips.length === 0 ? (
          <ErrorState description={error} onRetry={retry} title="Trips did not load" />
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState
            actionLabel="Create your first trip"
            description="Start a trip, add the group, and log the first bill before the WhatsApp math begins."
            icon={Map}
            onAction={() => setShowCreateModal(true)}
            title="No trips yet"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            description={`No trips match "${search}". Try a different name.`}
            title="No results"
          />
        ) : (
          <>
            {error ? (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <p>Some trip records may be missing. {error}</p>
                <Button onClick={retry} size="sm" type="button" variant="secondary">Retry</Button>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </>
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

      <Modal
        description="Paste a Contri invite link or enter its trip code."
        onClose={() => setShowJoinModal(false)}
        open={showJoinModal}
        title="Join a trip"
      >
        <form className="space-y-4" onSubmit={handleJoinTrip}>
          <Input
            autoComplete="off"
            hint="A trip code is the ID included in the trip’s invite link."
            label="Invite link or trip code"
            onChange={(event) => {
              setInviteValue(event.target.value)
              setInviteError('')
            }}
            placeholder="Paste invite link or trip code"
            type="text"
            value={inviteValue}
          />
          {inviteError ? <p className="text-sm text-red-600" role="alert">{inviteError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setShowJoinModal(false)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={!inviteValue.trim()} type="submit">
              <Link2 className="h-4 w-4" />
              Continue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
