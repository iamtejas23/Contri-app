import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { continueAsGuest } from '../services/auth'
import { joinTripByLink } from '../services/trips'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export const JoinTripPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  const tripId = searchParams.get('tripId')

  useEffect(() => {
    if (!tripId || authLoading || started.current) return
    started.current = true

    const join = async () => {
      setJoining(true)
      setError('')
      try {
        const memberUser = user || (await continueAsGuest())
        await joinTripByLink({
          tripId,
          member: {
            uid: memberUser.uid,
            name: profile?.name || memberUser.displayName || 'Guest',
            email: profile?.email || memberUser.email || '',
            upiId: profile?.upiId || '',
          },
        })
        navigate(`/trips/${tripId}`, { replace: true })
      } catch (joinError) {
        setError(
          joinError instanceof Error
            ? joinError.message
            : 'Could not join this trip. Ask the trip admin for a new link.',
        )
      } finally {
        setJoining(false)
      }
    }

    join()
  }, [authLoading, navigate, profile, tripId, user])

  return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Trip invite</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">
        {joining || authLoading ? 'Opening your trip…' : tripId ? 'Could not join yet' : 'Trip link missing'}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-sm text-dusk/70">
        {joining || authLoading
          ? 'You can join this trip as a guest without setting up an account.'
          : error || (tripId
            ? 'This invite may have expired. Ask the trip admin to share a fresh link.'
            : 'This invite link is missing a trip. Ask a friend to share it again from Contri.')}
      </p>
      {!user && !joining && !authLoading && tripId ? (
        <Button className="mt-6" onClick={() => window.location.reload()} type="button">
          Try joining as guest
        </Button>
      ) : null}
      <Button
        className="mt-6"
        onClick={() => navigate('/')}
        type="button"
        variant="secondary"
      >
        Back to trips
      </Button>
    </Card>
  )
}
