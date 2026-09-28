import { formatCurrency } from './currency'

export const BRAND_LINE = 'Trip khatam. Hisab bhi khatam.'

export const buildWhatsAppLink = (text) =>
  `https://wa.me/?text=${encodeURIComponent(text)}`

export const openWhatsApp = (text) => {
  window.open(buildWhatsAppLink(text), '_blank', 'noopener,noreferrer')
}

export const buildInviteMessage = ({ tripName, inviteLink }) =>
  `Join "${tripName}" on Contri.\nLog petrol, toll, food, and hotel as you go — settle the hisab before the group chat starts.\n\n${inviteLink}\n\n${BRAND_LINE}`

export const buildPaymentMessage = ({ fromName, toName, amount, currency, upiId, tripName }) => {
  const money = formatCurrency(amount, currency)
  const upiLine = upiId ? `\nUPI: ${upiId}` : '\nShare your UPI ID in Contri so this can be paid in one tap.'

  return `${fromName} → ${toName}: ${money}${upiLine}\nTrip: ${tripName}\n\n${BRAND_LINE}`
}

export const buildHisabMessage = ({ trip, suggestions = [], membersMap, totalSpent, budget }) => {
  const lines = [`*${trip.name} — hisab*`, `Spent ${formatCurrency(totalSpent, trip.currency)}`]

  if (budget) {
    lines.push(`Budget ${formatCurrency(budget, trip.currency)}`)
  }

  if (!suggestions.length) {
    lines.push('', 'Sab clear hai. Koi kisi ko nahi deta.')
  } else {
    lines.push('', 'Who owes whom:')
    suggestions.forEach((item) => {
      const from = membersMap[item.from]?.name || 'Someone'
      const to = membersMap[item.to]?.name || 'Someone'
      lines.push(`• ${from} pays ${to} ${formatCurrency(item.amount, trip.currency)}`)
    })
  }

  lines.push('', BRAND_LINE)
  return lines.join('\n')
}
