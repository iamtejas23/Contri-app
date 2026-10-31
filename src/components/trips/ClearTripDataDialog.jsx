import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

export const ClearTripDataDialog = ({ open, tripName, loading = false, onClose, onConfirm }) => {
  const [typedName, setTypedName] = useState('')
  const [finalReview, setFinalReview] = useState(false)
  const exactNameMatches = typedName === tripName

  const close = () => {
    if (loading) return
    setTypedName('')
    setFinalReview(false)
    onClose()
  }

  const handleContinue = (event) => {
    event.preventDefault()
    if (exactNameMatches) setFinalReview(true)
  }

  const handleConfirm = async () => {
    if (!exactNameMatches || !finalReview || loading) return
    const succeeded = await onConfirm()
    if (succeeded) {
      setTypedName('')
      setFinalReview(false)
    }
  }

  return (
    <Modal
      description="This action permanently removes records for this trip."
      onClose={close}
      open={open}
      size="compact"
      title="Clear trip data?"
    >
      {finalReview ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">Final confirmation</p>
                <p className="mt-1 break-words text-sm text-red-700">Clear expenses, settlements, activity history, and notifications associated with <strong>{tripName}</strong>?</p>
              </div>
            </div>
          </div>
          <p className="text-sm leading-6 text-dusk">Trip details, members, roles, invitations and settings will remain. Members can add new expenses once clearing finishes.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={loading} onClick={() => setFinalReview(false)} type="button" variant="secondary">Go back</Button>
            <Button className="bg-red-600 hover:bg-red-700" loading={loading} onClick={handleConfirm} type="button" variant="danger">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Clear trip data
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleContinue}>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-700">Records that will be permanently removed</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
                  <li>Trip expenses and transactions</li>
                  <li>Settlement records</li>
                  <li>Trip activity history</li>
                  <li>Notifications with this trip ID for its members</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-sand px-4 py-3 text-sm leading-6 text-ink">
            <strong>Kept unchanged:</strong> this trip, its name and settings, all members and roles, and its invitations. No other trip or personal profile records are included.
          </div>
          <Input
            autoComplete="off"
            label={`Type the trip name exactly: ${tripName}`}
            onChange={(event) => setTypedName(event.target.value)}
            value={typedName}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={loading} onClick={close} type="button" variant="secondary">Cancel</Button>
            <Button disabled={!exactNameMatches || loading} type="submit" variant="danger">Review deletion</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
