import { CalendarDays, Link2, MapPin, QrCode, Users, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'

import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { TripQrScanner } from '../components/trips/TripQrScanner'
import { useAuth } from '../context/useAuth'
import { db } from '../firebase/config'
import { getTripIdFromInvite } from '../lib/invites'
import { getErrorMessage } from '../lib/errors'
import { createGuestAccount } from '../services/auth'
import { joinTripByLink } from '../services/trips'
import { isValidTripInvitationPreview, loadTripInvitationPreview } from '../services/tripInvitationPreview'

const formatDate = (value) => {
  if (!value) return ''
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

export const JoinTripPage = () => {
  const { tripId: pathTripId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const requestedTripId = pathTripId || searchParams.get('tripId') || ''
  const tripId = useMemo(() => getTripIdFromInvite(requestedTripId), [requestedTripId])
  const invitePath = `${location.pathname}${location.search}`
  const [manualValue, setManualValue] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewState, setPreviewState] = useState('idle')
  const [previewError, setPreviewError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [manualError, setManualError] = useState('')

  useEffect(() => {
    let alive = true
    if (!tripId) return undefined

    Promise.resolve()
      .then(() => {
        if (alive) {
          setPreviewState('loading')
          setPreviewError('')
          setPreview(null)
          setAlreadyMember(false)
        }
        return loadTripInvitationPreview({ database: db, tripId })
      })
      .then((result) => {
        if (!alive) return
        if (isValidTripInvitationPreview(result, tripId)) {
          setPreview(result)
          setPreviewState('ready')
        } else {
          setPreviewState('legacy')
        }
      })
      .catch((error) => {
        if (!alive) return
        setPreviewState('error')
        setPreviewError(getErrorMessage(error, 'We could not load this invite preview. Check your connection and try again.'))
      })

    return () => { alive = false }
  }, [tripId])

  useEffect(() => {
    let alive = true
    if (!tripId || !user || user.isAnonymous && authLoading) return undefined
    getDoc(doc(db, 'trips', tripId))
      .then((snapshot) => {
        if (!alive || !snapshot.exists()) return
        const data = snapshot.data()
        const member = data.memberIds?.includes(user.uid)
          && data.members?.some((entry) => entry.uid === user.uid)
        if (member) setAlreadyMember(true)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [authLoading, tripId, user])

  const continueToInvite = (value) => {
    const parsedTripId = getTripIdFromInvite(value)
    if (!parsedTripId) {
      setManualError('That does not look like a Contri invite link or trip code.')
      return
    }
    navigate(`/join/${encodeURIComponent(parsedTripId)}`)
  }

  const handleScannedCode = useCallback((rawValue) => {
    setScannerOpen(false)
    const parsedTripId = getTripIdFromInvite(rawValue)
    if (!parsedTripId) {
      setManualError('This QR code is not a valid Contri trip invitation. Try scanning again or enter the code manually.')
      return
    }
    navigate(`/join/${encodeURIComponent(parsedTripId)}`)
  }, [navigate])

  const performJoin = async (joiningUser, displayName = '', contactEmail = '') => {
    if (joining || !tripId || !joiningUser) return
    setJoining(true)
    setJoinError('')
    try {
      await joinTripByLink({
        tripId,
        member: {
          uid: joiningUser.uid,
          name: profile?.name || displayName || joiningUser.displayName || 'Traveler',
          email: profile?.email || joiningUser.email || contactEmail || '',
          photoURL: profile?.photoURL || joiningUser.photoURL || '',
          upiId: profile?.upiId || '',
          isAnonymous: joiningUser.isAnonymous,
        },
      })
      toast.success(alreadyMember ? 'You are already a trip member.' : 'You joined the trip.')
      navigate(`/trips/${encodeURIComponent(tripId)}`, { replace: true })
    } catch (error) {
      setJoinError(getErrorMessage(error, 'We could not join this trip. Check the invitation and your connection, then try again.'))
    } finally {
      setJoining(false)
    }
  }

  const handleGuestJoin = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setJoinError('Enter your display name to continue as a guest.')
      return
    }
    if (joining) return
    setJoining(true)
    setJoinError('')
    try {
      const guest = user?.isAnonymous
        ? user
        : await createGuestAccount({ name: name.trim(), contactEmail: email.trim() })
      await joinTripByLink({
        tripId,
        member: {
          uid: guest.uid,
          name: guest.displayName || name.trim(),
          email: guest.email || email.trim(),
          photoURL: guest.photoURL || '',
          isAnonymous: guest.isAnonymous,
        },
      })
      toast.success('You joined the trip as a guest.')
      navigate(`/trips/${encodeURIComponent(tripId)}`, { replace: true })
    } catch (error) {
      setJoinError(getErrorMessage(error, 'We could not create your guest account or join this trip. Try again.'))
    } finally {
      setJoining(false)
    }
  }

  if (scannerOpen) return <TripQrScanner onClose={() => setScannerOpen(false)} onCode={handleScannedCode} />

  if (!tripId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="overflow-hidden p-0">
          <div className="mesh-brand-panel px-5 py-7 text-white sm:px-8 sm:py-9">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Trip invitations</p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Join your group</h1>
            <p className="mt-2 max-w-lg text-sm text-white/75">Scan a Contri QR code or enter the invitation code shared by a trip admin. You’ll review the trip before joining.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
            <button className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal/50 hover:bg-slate-50" onClick={() => { setManualError(''); setScannerOpen(true) }} type="button">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><QrCode className="h-6 w-6" /></span>
              <span><strong className="block text-sm text-ink">Scan QR code</strong><span className="mt-1 block text-xs leading-5 text-dusk">Use your device camera to scan a trip invitation.</span></span>
            </button>
            <div className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-teal"><Link2 className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm text-ink">Enter invite code</strong>
                <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); continueToInvite(manualValue) }}>
                  <Input aria-label="Invitation link or trip code" autoComplete="off" className="min-w-0" onChange={(event) => { setManualValue(event.target.value); setManualError('') }} placeholder="Paste link or code" value={manualValue} />
                  <Button aria-label="Continue with invite code" className="min-h-11 min-w-11 px-3" disabled={!manualValue.trim()} type="submit"><Link2 className="h-4 w-4" /></Button>
                </form>
              </div>
            </div>
          </div>
          {manualError ? <p className="px-5 pb-4 text-sm text-red-600" role="alert">{manualError}</p> : null}
        </Card>
        <p className="text-center text-xs text-dusk">Camera access is requested only when you start scanning. Manual entry works without a camera.</p>
      </div>
    )
  }

  const dateRange = [formatDate(preview?.startDate), formatDate(preview?.endDate)].filter(Boolean).join(' – ')

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card className="overflow-hidden p-0">
        <div className="mesh-brand-panel px-5 py-7 text-white sm:px-8 sm:py-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Trip invitation</p>
          {previewState === 'loading' ? <div aria-label="Loading trip preview" className="mt-3 h-8 w-3/4 animate-pulse rounded-lg bg-white/15" /> : (
            <h1 className="mt-2 break-words font-display text-3xl font-bold sm:text-4xl">{preview ? `${preview.emoji || '🧳'} ${preview.tripName}` : 'You’re invited to a Contri trip'}</h1>
          )}
          {preview?.description ? <p className="mt-3 max-w-lg break-words text-sm text-white/75">{preview.description}</p> : null}
          {dateRange ? <p className="mt-3 inline-flex items-center gap-2 text-sm text-white/75"><CalendarDays className="h-4 w-4" />{dateRange}</p> : null}
        </div>

        <div className="space-y-5 p-5 sm:p-8">
          {previewState === 'loading' ? <p aria-live="polite" className="text-sm text-dusk">Checking this invitation…</p> : null}
          {previewState === 'error' ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{previewError}</div> : null}
          {previewState === 'legacy' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-dusk">
              This is an older Contri invitation. Its trip details are not available in a safe preview. You can still confirm and try joining; Contri will verify membership before opening the trip.
            </div>
          ) : null}
          {preview ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-dusk">
            {preview.memberCount ? <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-cyan-600" />{preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}</span> : null}
            {preview.description ? <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-violet-600" />Trip details</span> : null}
          </div> : null}
          <p className="text-sm leading-6 text-dusk">Joining lets you view this trip’s expenses and balances and add expenses according to trip membership rules.</p>

          {alreadyMember ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">You’re already a member of this trip.</div> : null}
          {joinError ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{joinError}</div> : null}

          {user ? (
            <div className="space-y-3">
              <Button className="min-h-12 w-full" disabled={previewState === 'loading'} loading={joining} onClick={() => alreadyMember ? navigate(`/trips/${encodeURIComponent(tripId)}`) : void performJoin(user)} type="button">
                {alreadyMember ? 'Open trip' : 'Join Trip'}
              </Button>
              <Button className="w-full" onClick={() => navigate('/join')} type="button" variant="ghost">Use another invitation</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button className="min-h-12 w-full" onClick={() => navigate('/login', { state: { from: invitePath } })} type="button" variant="secondary"><UserRound className="h-4 w-4" />Sign in to join</Button>
              <div className="relative py-1 text-center text-xs text-dusk"><span className="bg-white px-2">or continue as guest</span><span aria-hidden="true" className="absolute inset-x-0 top-1/2 -z-10 border-t border-slate-200" /></div>
              <form className="space-y-3" onSubmit={handleGuestJoin}>
                <Input autoComplete="name" label="Display name" onChange={(event) => setName(event.target.value)} placeholder="Your name" required value={name} />
                <Input autoComplete="email" label="Email (optional)" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
                <Button className="min-h-12 w-full" disabled={previewState === 'loading'} loading={joining} type="submit">Create guest account & join</Button>
                <p className="text-xs leading-5 text-dusk">Guest accounts are anonymous and may be difficult to recover if you sign out or change devices.</p>
              </form>
            </div>
          )}
          <Link className="block text-center text-sm text-dusk underline decoration-slate-300 underline-offset-4" to="/">Back to trips</Link>
        </div>
      </Card>
    </div>
  )
}
