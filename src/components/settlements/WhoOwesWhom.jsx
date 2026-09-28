import { ArrowRight, CheckCircle2, MessageCircle, Smartphone } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { formatCurrency } from '../../lib/currency'
import { buildPaymentMessage, openWhatsApp } from '../../lib/share'
import { buildUpiLink, openUpiPayment } from '../../lib/upi'
import { Button } from '../ui/Button'

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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-dusk">{label}</p>
                <p className="mt-1 flex items-center gap-2 font-semibold text-ink">
                  <span className="truncate">{from?.name || 'Someone'}</span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-teal" />
                  <span className="truncate">{to?.name || 'Someone'}</span>
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-ink">
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
