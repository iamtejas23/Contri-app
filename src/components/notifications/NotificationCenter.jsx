import { Bell, Check, CircleAlert, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { useNotifications } from '../../hooks/useNotifications'
import { formatCurrency } from '../../lib/currency'
import { timeAgo } from '../../lib/date'
import { markNotificationRead } from '../../services/notifications'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { Skeleton } from '../ui/Skeleton'

export const NotificationCenter = ({ uid }) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const { notifications, unreadCount, loading, error, retry } = useNotifications(uid)

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
                <span className={`mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${notification.read ? 'bg-slate-100 text-dusk' : 'bg-teal/10 text-teal'}`}>
                  {notification.read ? <Check aria-hidden="true" className="h-4 w-4" /> : <Bell aria-hidden="true" className="h-4 w-4" />}
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
    </>
  )
}
