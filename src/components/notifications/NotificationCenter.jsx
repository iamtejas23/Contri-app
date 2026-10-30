import { Bell, Check, CircleAlert, ExternalLink, LoaderCircle, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { useNotifications } from '../../hooks/useNotifications'
import { formatCurrency } from '../../lib/currency'
import { timeAgo } from '../../lib/date'
import {
  clearAllNotifications,
  clearNotificationsForTrip,
  getNotificationTrips,
  markNotificationRead,
} from '../../services/notifications'
import { getConfirmedNotificationClearAction } from '../../services/notificationClearing.js'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { Skeleton } from '../ui/Skeleton'
import { Avatar } from '../ui/Avatar'

export const NotificationCenter = ({ uid, currentUserPhotoURL }) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const [clearDialog, setClearDialog] = useState(null)
  const [tripOptions, setTripOptions] = useState([])
  const [loadingTrips, setLoadingTrips] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deletePendingRef = useRef(false)
  const tripLoadPendingRef = useRef(false)
  const { notifications, unreadCount, loading, error, retry, dismissNotifications } = useNotifications(uid)

  const openTripPicker = async () => {
    if (tripLoadPendingRef.current || deletePendingRef.current) return
    tripLoadPendingRef.current = true
    setClearDialog({ kind: 'trip-picker' })
    setLoadingTrips(true)
    try {
      setTripOptions(await getNotificationTrips({ uid }))
    } catch {
      toast.error('Could not load trips from your notifications. Check your connection and try again.')
      setClearDialog(null)
    } finally {
      tripLoadPendingRef.current = false
      setLoadingTrips(false)
    }
  }

  const confirmClear = async () => {
    if (deletePendingRef.current || !uid) return
    const action = getConfirmedNotificationClearAction(clearDialog)
    if (!action) return
    deletePendingRef.current = true
    setDeleting(true)
    try {
      const result = action.type === 'all'
        ? await clearAllNotifications({ uid })
        : await clearNotificationsForTrip({ uid, tripId: action.tripId })
      dismissNotifications(result)
      toast.success(result.deletedCount
        ? `Removed ${result.deletedCount} notification${result.deletedCount === 1 ? '' : 's'}.`
        : 'There were no notifications to remove.')
      setClearDialog(null)
    } catch {
      toast.error('Could not remove notifications. Check your connection and try again.')
    } finally {
      deletePendingRef.current = false
      setDeleting(false)
    }
  }

  const openTrip = async (notification) => {
    if (pendingId) return
    setPendingId(notification.id)
    try {
      if (!notification.read) {
        await markNotificationRead({ uid, notificationId: notification.id })
      }
      setOpen(false)
      navigate(`/trips/${notification.tripId}?tab=expenses`)
    } catch {
      toast.error('Could not update this notification. Check your connection and try again.')
    } finally {
      setPendingId('')
    }
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-dusk transition hover:bg-slate-100 hover:text-ink"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-coral px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <Modal
        description={unreadCount ? `${unreadCount} unread` : 'Your trip updates will appear here.'}
        onClose={() => setOpen(false)}
        open={open}
        title="Notifications"
      >
        {!loading ? (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <Button
              className="min-h-11"
              disabled={deleting || Boolean(pendingId)}
              onClick={() => setClearDialog({ kind: 'all-confirm' })}
              type="button"
              variant="danger"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Clear all
            </Button>
            <Button
              className="min-h-11"
              disabled={deleting || Boolean(pendingId) || loadingTrips}
              onClick={openTripPicker}
              type="button"
              variant="secondary"
            >
              Clear by trip
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <CircleAlert aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <Button onClick={retry} size="sm" type="button" variant="secondary">Retry</Button>
          </div>
        ) : null}

        {loading ? (
          <div aria-label="Loading notifications" className="space-y-3">
            {[0, 1, 2].map((item) => <Skeleton className="h-20" key={item} />)}
          </div>
        ) : notifications.length ? (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const isOwnNotification = notification.actorUid === uid
              const amount = formatCurrency(notification.amount, notification.currency)
              return (
              <button
                className={`flex min-h-20 w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition hover:border-teal/30 hover:bg-teal/5 disabled:opacity-60 sm:p-4 ${notification.read ? 'border-slate-200 bg-white' : 'border-teal/20 bg-teal/5'}`}
                disabled={pendingId === notification.id}
                key={notification.id}
                onClick={() => openTrip(notification)}
                type="button"
              >
                <span className="relative mt-1 flex-shrink-0">
                  <Avatar
                    label={`${notification.actorName || 'Trip member'} avatar`}
                    name={notification.actorName || 'Trip member'}
                    size="sm"
                    src={notification.actorUid === uid ? currentUserPhotoURL : ''}
                    uid={notification.actorUid}
                  />
                  <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-sand ${notification.read ? 'bg-slate-300 text-slate-700' : 'bg-amber-500 text-black'}`}>
                    {notification.read ? <Check aria-hidden="true" className="h-2.5 w-2.5" /> : <Bell aria-hidden="true" className="h-2.5 w-2.5" />}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">
                      {isOwnNotification ? `You added ${amount} for ${notification.expenseTitle}` : `${notification.actorName} added an expense`}
                    </span>
                    <span className="whitespace-nowrap text-xs text-dusk">{timeAgo(notification.createdAt)}</span>
                  </span>
                  <span className="mt-1 block break-words text-sm text-dusk">
                    {isOwnNotification ? `in ${notification.tripName}` : `${notification.expenseTitle} · ${amount} in ${notification.tripName}`}
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400" />
              </button>
              )
            })}
          </div>
        ) : error ? null : (
          <EmptyState description="New expenses added by your trip members will show up here." title="You’re all caught up" />
        )}
      </Modal>

      <Modal
        description={clearDialog?.kind === 'trip-picker'
          ? 'Only notifications with a saved trip ID are listed.'
          : 'This permanently removes the selected notifications from your account.'}
        onClose={() => { if (!deleting) setClearDialog(null) }}
        open={Boolean(clearDialog)}
        title={clearDialog?.kind === 'trip-picker' ? 'Clear by trip' : 'Confirm deletion'}
      >
        {clearDialog?.kind === 'trip-picker' ? (
          loadingTrips ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-dusk" role="status">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
              Loading trips…
            </div>
          ) : tripOptions.length ? (
            <div className="space-y-2">
              {tripOptions.map((tripOption) => (
                <button
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-teal/40 hover:bg-teal/5"
                  key={tripOption.tripId}
                  onClick={() => setClearDialog({ kind: 'trip-confirm', trip: tripOption })}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-semibold text-ink">{tripOption.tripName}</span>
                    <span className="mt-0.5 block text-xs text-dusk">{tripOption.count} notification{tripOption.count === 1 ? '' : 's'}</span>
                  </span>
                  <Trash2 aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-dusk" />
                </button>
              ))}
              <p className="pt-2 text-xs leading-5 text-dusk">
                Older notifications without a trip ID are left untouched by this action.
              </p>
            </div>
          ) : (
            <EmptyState
              description="Notifications without a saved trip ID are kept safe and cannot be grouped by trip."
              title="No trips to clear"
            />
          )
        ) : clearDialog?.kind === 'all-confirm' ? (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-dusk">
              All notifications in your account will be removed. Trips, expenses, settlements, members, and other users’ notifications will not be affected.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button disabled={deleting} onClick={() => setClearDialog(null)} type="button" variant="secondary">Cancel</Button>
              <Button loading={deleting} onClick={confirmClear} type="button" variant="danger">
                Delete all notifications
              </Button>
            </div>
          </div>
        ) : clearDialog?.kind === 'trip-confirm' ? (
          <div className="space-y-5">
            <p className="break-words text-sm leading-6 text-dusk">
              Remove {clearDialog.trip.count} notification{clearDialog.trip.count === 1 ? '' : 's'} for <strong className="text-ink">{clearDialog.trip.tripName}</strong>? Notifications without this exact trip ID and all other account data will remain untouched.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button disabled={deleting} onClick={() => setClearDialog({ kind: 'trip-picker' })} type="button" variant="secondary">Back</Button>
              <Button loading={deleting} onClick={confirmClear} type="button" variant="danger">
                Delete trip notifications
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
