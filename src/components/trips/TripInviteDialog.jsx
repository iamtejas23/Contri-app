import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import QRCode from 'qrcode'
import { Check, Copy, Download, Link2, QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { db } from '../../firebase/config'
import { buildTripInviteLink } from '../../lib/invites'
import { copyToClipboard } from '../../lib/utils'
import { publishTripInvitationPreview } from '../../services/tripInvitationPreview'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export const TripInviteDialog = ({ open, onClose, trip, inviteOrigin }) => {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tripId = trip?.id
  const inviteLink = tripId ? buildTripInviteLink(tripId, inviteOrigin) : ''
  const previewTripJson = JSON.stringify(trip ? ({
    name: trip.name,
    description: trip.description || '',
    emoji: trip.emoji || '🧳',
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    memberIds: Array.isArray(trip.memberIds) ? trip.memberIds : [],
  }) : null)

  useEffect(() => {
    let active = true
    if (!open || !previewTripJson || !tripId) return undefined

    Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true)
          setError('')
          setQrDataUrl('')
        }
        return publishTripInvitationPreview({ database: db, trip: JSON.parse(previewTripJson), tripId })
      })
      .then(() => QRCode.toDataURL(inviteLink, {
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 768,
        color: { dark: '#09090B', light: '#FFFFFF' },
      }))
      .then((dataUrl) => { if (active) setQrDataUrl(dataUrl) })
      .catch(() => { if (active) setError('We could not prepare the invite QR. Check your connection and try again.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [inviteLink, open, previewTripJson, tripId])

  const copy = async (value, label) => {
    try {
      await copyToClipboard(value)
      toast.success(`${label} copied.`)
    } catch {
      toast.error(`Could not copy the ${label.toLowerCase()}.`)
    }
  }

  const shareInvite = async () => {
    const text = `Join ${trip.name} on Contri. Scan the QR or open this invite: ${inviteLink}`
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: `${trip.name} · Contri`, text, url: inviteLink, dialogTitle: 'Share trip invitation' })
      } else if (navigator.share) {
        await navigator.share({ title: `${trip.name} · Contri`, text, url: inviteLink })
      } else {
        await copy(inviteLink, 'Invite link')
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') toast.error('Could not share this invitation.')
    }
  }

  return (
    <Modal description="Scan this QR code to join the trip." onClose={onClose} open={open} title="Share trip invitation" size="narrow">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <p aria-live="polite" className="text-sm font-medium text-ink">{trip?.name}</p>
          {loading ? (
            <div aria-label="Preparing QR code" className="mx-auto mt-4 flex aspect-square w-full max-w-[18rem] animate-pulse items-center justify-center rounded-xl bg-slate-100">
              <QrCode className="h-10 w-10 text-dusk/40" />
            </div>
          ) : qrDataUrl ? (
            <img alt={`QR code invitation to join ${trip.name}`} className="mx-auto mt-4 aspect-square w-full max-w-[18rem] rounded-xl bg-white p-2" src={qrDataUrl} />
          ) : (
            <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>
          )}
          <p className="mt-3 text-sm text-dusk">Scan this QR code to join the trip.</p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dusk">Invitation code</p>
          <p className="mt-1 break-all font-mono text-sm text-ink">{tripId}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="w-full" onClick={() => copy(inviteLink, 'Invite link')} size="sm" type="button" variant="secondary">
            <Link2 className="h-4 w-4" /> Copy link
          </Button>
          <Button className="w-full" onClick={() => copy(tripId, 'Invite code')} size="sm" type="button" variant="secondary">
            <Copy className="h-4 w-4" /> Copy code
          </Button>
          <Button className="w-full" disabled={!qrDataUrl} onClick={shareInvite} size="sm" type="button" variant="secondary">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <a
            aria-disabled={!qrDataUrl}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-ink ${qrDataUrl ? 'hover:bg-slate-50' : 'pointer-events-none opacity-50'}`}
            download={`contri-trip-${tripId}-qr.png`}
            href={qrDataUrl || undefined}
          >
            <Download className="h-4 w-4" /> Save QR
          </a>
        </div>
        <p className="mt-3 text-xs leading-5 text-dusk">The QR contains the trip invitation code only. Trip details are shown in Contri before a member confirms joining.</p>
        <Button className="mt-4 w-full" onClick={onClose} type="button" variant="ghost"><Check className="h-4 w-4" /> Done</Button>
      </div>
    </Modal>
  )
}
