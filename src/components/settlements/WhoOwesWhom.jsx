import { ArrowRight, CheckCircle2, MessageCircle, Smartphone } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { formatCurrency } from '../../lib/currency'
import { buildPaymentMessage, openWhatsApp } from '../../lib/share'
import { buildUpiLink, openUpiPayment } from '../../lib/upi'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'

export const WhoOwesWhom = ({
  suggestions = [],
  membersMap = {},
  currency = 'INR',
  tripName = 'Trip',
  currentUserId,
  onMarkPaid,
}) => {
  const [pendingKey, setPendingKey] = useState('')

  if (!suggestions.length) {
    return (
      <div className="rounded-2xl border border-teal/20 bg-teal/5 px-5 py-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-teal" />
        <p className="mt-3 font-display text-xl font-bold text-ink">Sab clear hai.</p>
        <p className="mt-1 text-sm text-dusk">Trip khatam. Hisab bhi khatam.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((item) => {
        const from = membersMap[item.from]
        const to = membersMap[item.to]
        const key = `${item.from}-${item.to}-${item.amount}`
        const youPay = item.from === currentUserId
        const youReceive = item.to === currentUserId
        const canUpi = currency === 'INR' && Boolean(to?.upiId)
        const label = youPay
          ? `You pay ${to?.name || 'them'}`
          : youReceive
            ? `${from?.name || 'They'} pays you`
            : `${from?.name || 'Someone'} pays ${to?.name || 'someone'}`

        const shareText = buildPaymentMessage({
          fromName: from?.name || 'Someone',
          toName: to?.name || 'Someone',
          amount: item.amount,
          currency,
          upiId: to?.upiId,
          tripName,
        })

        return (
          <article
            key={key}
            className="animate-rise rounded-2xl border border-slate-200 bg-white p-4 shadow-float"
          >
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-dusk">{label}</p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Avatar label={`${from?.name || 'Unknown member'}, payer`} name={from?.name || 'Unknown member'} size="sm" src={from?.photoURL} uid={item.from} />
                    <span className="max-w-[9rem] break-words text-sm font-semibold text-ink">{from?.name || 'Unknown member'}</span>
                  </span>
                  <ArrowRight aria-label="pays" className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Avatar label={`${to?.name || 'Unknown member'}, receiver`} name={to?.name || 'Unknown member'} size="sm" src={to?.photoURL} uid={item.to} />
                    <span className="max-w-[9rem] break-words text-sm font-semibold text-ink">{to?.name || 'Unknown member'}</span>
                  </span>
                </div>
              </div>
              <p className="font-display text-2xl font-bold text-blue-500 sm:text-right">
                {formatCurrency(item.amount, currency)}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {canUpi && (youPay || !currentUserId) ? (
                <Button
                  onClick={() => {
                    openUpiPayment(
                      buildUpiLink({
                        upiId: to.upiId,
                        name: to.name,
                        amount: item.amount,
                        note: `${tripName} settlement`,
                      }),
                    )
                    toast.success('Opening UPI. Mark it paid once the transfer lands.')
                  }}
                  size="sm"
                  type="button"
                >
                  <Smartphone className="h-4 w-4" />
                  Pay with UPI
                </Button>
              ) : null}
              <Button
                onClick={() => openWhatsApp(shareText)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              {onMarkPaid ? (
                <Button
                  loading={pendingKey === key}
                  onClick={async () => {
                    setPendingKey(key)
                    try {
                      await onMarkPaid(item)
                    } finally {
                      setPendingKey('')
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Mark paid
                </Button>
              ) : null}
            </div>
            {currency === 'INR' && !to?.upiId ? (
              <p className="mt-3 text-xs text-dusk">
                {to?.name || 'They'} has no UPI ID yet. Ask on WhatsApp, or add yours in Profile.
              </p>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
