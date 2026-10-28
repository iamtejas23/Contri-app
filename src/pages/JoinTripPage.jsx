import { useEffect, useRef, useState } from 'react'
import { Link2, UserRound } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { getTripIdFromInvite } from '../lib/invites'
import { createGuestAccount } from '../services/auth'
import { joinTripByLink } from '../services/trips'
import { getErrorMessage } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export const JoinTripPage = () => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [joining, setJoining] = useState(false)
  const [joinAttempt, setJoinAttempt] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [inviteValue, setInviteValue] = useState(searchParams.get('tripId') || '')
  const [error, setError] = useState('')
  const started = useRef(false)

  const tripId = searchParams.get('tripId')

  useEffect(() => {
    if (!tripId || authLoading || !user || started.current) return
    started.current = true

    const join = async () => {
      setJoining(true)
      setError('')
      try {
        await joinTripByLink({
          tripId,
          member: {
            uid: user.uid,
            name: profile?.name || user.displayName || 'Traveler',
            email: profile?.email || user.email || '',
            upiId: profile?.upiId || '',
            isAnonymous: user.isAnonymous,
          },
        })
        navigate(`/trips/${encodeURIComponent(tripId)}`, { replace: true })
      } catch (joinError) {
        setError(getErrorMessage(joinError, 'We could not confirm your membership. Check your connection and invite, then try again.'))
        started.current = false
      } finally {
        setJoining(false)
      }
    }

    join()
  }, [authLoading, joinAttempt, navigate, profile, tripId, user])

  const handleGuestJoin = async (event) => {
    event.preventDefault()
    if (joining) return

    const requestedTripId = getTripIdFromInvite(inviteValue)
    if (inviteValue.trim() && !requestedTripId) {
      setError('Enter a valid Contri invite link or trip ID.')
      return
    }

    setJoining(true)
    setError('')
    try {
      const guest = user?.isAnonymous
        ? await createGuestAccount({ name, contactEmail: email })
        : user || await createGuestAccount({ name, contactEmail: email })

      if (requestedTripId) {
        await joinTripByLink({
          tripId: requestedTripId,
          member: {
            uid: guest.uid,
            name: guest.displayName || name.trim(),
            email: guest.email || '',
            isAnonymous: guest.isAnonymous,
          },
        })
        navigate(`/trips/${encodeURIComponent(requestedTripId)}`, { replace: true })
      } else {
        navigate('/', { replace: true, state: { fromGuestJoin: true } })
      }
    } catch (guestError) {
      setError(guestError instanceof Error ? guestError.message : 'Guest sign-in or trip joining failed. Check your connection and try again.')
    } finally {
      setJoining(false)
    }
  }

  const isWaitingForExistingJoin = Boolean(tripId && (authLoading || (user && joining)))

  return (
    <Card className="mx-auto max-w-2xl p-5 sm:p-8">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Trip invite</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink">
            {isWaitingForExistingJoin ? 'Opening your trip…' : 'Join as Guest'}
          </h1>
          <p className="mx-auto mt-3 text-sm text-dusk/75">
            Use an invite link or trip ID. Guests can view expenses, add expenses, and see trip balances like other members.
          </p>
        </div>

        {isWaitingForExistingJoin ? (
          <p aria-live="polite" className="mt-6 text-center text-sm text-dusk">Joining the trip…</p>
        ) : tripId && user && error ? (
          <div className="mt-6 space-y-4" role="alert">
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">
              Your membership was not confirmed, so this trip has not been opened. {error}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                disabled={joining}
                onClick={() => setJoinAttempt((attempt) => attempt + 1)}
                type="button"
              >
                Try joining again
              </Button>
              <Button onClick={() => navigate('/')} type="button" variant="secondary">
                Back to trips
              </Button>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleGuestJoin}>
            <Input
              autoComplete="name"
              label="Display name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="How should the group see you?"
              required
              value={name}
            />
            <Input
              autoComplete="email"
              hint="Optional and not verified; it is saved as contact information only."
              label="Email (optional)"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <Input
              autoCapitalize="none"
              autoComplete="off"
              hint="Use the trip ID from a Contri invite link, or paste the full link. Leave blank to join first and choose a trip later."
              label="Invite link or trip ID (optional)"
              onChange={(event) => setInviteValue(event.target.value)}
              placeholder="Paste invite link or trip ID"
              value={inviteValue}
            />

            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}

            <Button className="w-full" loading={joining} size="lg" type="submit">
              {inviteValue.trim() ? <Link2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              {inviteValue.trim() ? 'Create guest account and join' : 'Continue as guest'}
            </Button>
            <p className="text-xs leading-relaxed text-dusk/70">
              Your guest account uses Firebase Anonymous Authentication. If you sign out or lose this device, recovery may be difficult. Link Google from your profile to keep your existing account and trip data.
            </p>
          </form>
        )}

        <div className="mt-5 text-center">
          {error && tripId ? (
            <Button onClick={() => navigate('/')} type="button" variant="secondary">Back to trips</Button>
          ) : (
            <Button onClick={() => navigate(location.state?.from?.startsWith('/') ? location.state.from : '/')} type="button" variant="secondary">
              Back
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
