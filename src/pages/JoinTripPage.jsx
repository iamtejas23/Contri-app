import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { getDisplayName } from '../lib/utils'
import { joinTripByLink } from '../services/trips'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export const JoinTripPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [joining, setJoining] = useState(false)

  const tripId = searchParams.get('tripId')

  useEffect(() => {
    const join = async () => {
      if (!tripId || !user) {
        return
      }

      setJoining(true)

      try {
        await joinTripByLink({
          tripId,
          member: {
            uid: user.uid,
            name: getDisplayName(profile || user),
            email: profile?.email || user.email || '',
            upiId: profile?.upiId || '',
          },
        })
        toast.success('You joined the trip.')
        navigate(`/trips/${tripId}`, { replace: true })
      } catch {
        // Service layer already shows a toast for Firebase failures.
      } finally {
        setJoining(false)
      }
    }

    join()
  }, [navigate, profile, tripId, user])

  return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Invite link</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-ink">
        {joining ? 'Adding you to the trip…' : tripId ? 'Could not join yet' : 'Trip link missing'}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-sm text-dusk/70">
        {tripId
          ? joining
            ? 'Hang on. You will land on the hisab as soon as you are in the group.'
            : 'The invite did not go through. Ask the trip admin to share the WhatsApp link again.'
          : 'This invite link is missing a trip. Ask a friend to share it again from Contri.'}
      </p>
      <Button className="mt-6" onClick={() => navigate('/')} type="button" variant="secondary">
        {joining ? 'Working...' : 'Back to trips'}
      </Button>
    </Card>
  )
}
