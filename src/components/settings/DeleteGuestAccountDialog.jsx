import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import {
  completeGuestDeletionSession,
  GUEST_DELETION_CONFIRMATION,
  guestDeletionConfirmationMatches,
  loadGuestSharedTripSummary,
} from '../../services/guestAccountDeletion'
import { deleteCurrentGuestAccount } from '../../lib/guestAccountDeletion'

export const DeleteGuestAccountDialog = ({ user }) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [createdTripCount, setCreatedTripCount] = useState(0)

  useEffect(() => {
    if (!open || !user?.uid) return undefined
    let active = true
    loadGuestSharedTripSummary(user.uid)
      .then((summary) => { if (active) setCreatedTripCount(summary.createdTripCount) })
      .catch(() => { if (active) setCreatedTripCount(0) })
    return () => { active = false }
  }, [open, user?.uid])

  const close = () => {
    if (deleting) return
    setOpen(false)
    setConfirmation('')
  }

  const confirmDeletion = async () => {
    if (deleting || !guestDeletionConfirmationMatches(confirmation)) return
    setDeleting(true)
    try {
      const result = await deleteCurrentGuestAccount({ user })
      toast.success(result.alreadyDeleted ? 'This guest account was already deleted.' : 'Guest account deleted.')
      await completeGuestDeletionSession({ result, navigate })
    } catch (error) {
      const incomplete = error.cleanup ? ' Personal data cleanup may be incomplete.' : ''
      toast.error(`${error.message || 'The guest account could not be deleted.'}${incomplete}`)
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-red-700">Delete guest account</h3>
            <p className="mt-1 text-sm leading-5 text-red-700/90">Account deletion is permanent and cannot be undone. Shared trip expenses and financial history will remain unchanged.</p>
          </div>
        </div>
        <Button className="mt-3 min-h-11" onClick={() => setOpen(true)} type="button" variant="danger">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete guest account
        </Button>
      </div>
      <Modal description="This cannot be undone." onClose={close} open={open} size="compact" title="Delete guest account">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-dusk">Your guest account will be permanently deleted. You will lose access to this account and its personal settings. Shared trip expenses and financial history will remain unchanged.</p>
          {createdTripCount > 0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">You created {createdTripCount === 1 ? 'a shared trip' : `${createdTripCount} shared trips`}. Those trips will not be deleted and ownership will not be transferred automatically. That needs a separate process.</p>
          ) : null}
          <Input
            autoComplete="off"
            hint={`Type ${GUEST_DELETION_CONFIRMATION} to confirm.`}
            label="Confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={deleting} onClick={close} type="button" variant="secondary">Cancel</Button>
            <Button className="min-h-11" disabled={!guestDeletionConfirmationMatches(confirmation)} loading={deleting} onClick={confirmDeletion} type="button" variant="danger">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
