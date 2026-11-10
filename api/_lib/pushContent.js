const textValue = (value, limit = 96) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, limit)
  : ''

const tripName = (trip) => textValue(trip?.name || trip?.tripName)

const memberName = (trip, uid) => {
  if (!uid) return ''
  const member = Array.isArray(trip?.members)
    ? trip.members.find((entry) => entry?.uid === uid)
    : null
  return textValue(member?.name || member?.displayName)
}

const formatAmount = (value, currency = 'INR', paise = false) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  const normalized = paise ? amount / 100 : amount
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: textValue(currency).toUpperCase() || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(normalized)
  } catch {
    return `${textValue(currency) || 'INR'} ${normalized.toFixed(2)}`
  }
}

const withTrip = (sentence, name) => name ? `${sentence} in ${name}.` : `${sentence}.`
const withActor = (actorName) => actorName || 'A trip member'

export const buildPushNotificationContent = ({ eventType, trip, record = {}, activity = {} }) => {
  const name = tripName(trip)
  const actor = withActor(textValue(activity.actorName) || memberName(trip, activity.actorUid || record.createdBy || record.updatedBy || record.recordedBy))

  switch (eventType) {
    case 'expense_created': {
      const amount = formatAmount(record.amount, record.currency || trip?.currency)
      const title = textValue(record.title, 80)
      const details = title
        ? `${amount ? `${amount} ` : ''}for ${title}`
        : amount ? `${amount} expense` : 'an expense'
      return { title: 'New expense added', body: withTrip(`${actor} added ${details}`, name) }
    }
    case 'expense_updated': {
      const title = textValue(record.title, 80)
      return { title: 'Expense updated', body: withTrip(`${actor} updated${title ? ` the ${title} expense` : ' an expense'}`, name) }
    }
    case 'settlement_created':
    case 'settlement_updated': {
      const amount = formatAmount(record.amount ?? activity.meta?.amount, record.currency || trip?.currency)
      const verb = eventType === 'settlement_created' ? 'recorded' : 'updated'
      const phrase = amount ? `${actor} ${verb} a ${amount} payment` : `${actor} ${verb} a payment`
      return { title: eventType === 'settlement_created' ? 'Settlement recorded' : 'Settlement updated', body: withTrip(phrase, name) }
    }
    case 'advance_recorded': {
      const amount = formatAmount(record.amountPaise, trip?.currency || 'INR', true)
      const phrase = amount
        ? `${actor} recorded an advance contribution of ${amount}`
        : `${actor} recorded an advance contribution`
      return { title: 'Advance contribution added', body: withTrip(phrase, name) }
    }
    case 'trip_member_added':
      return { title: 'Trip invitation', body: name ? `You have been invited to join ${name}.` : 'You have been invited to join a Contri trip.' }
    case 'trip_member_joined':
      return { title: 'New member joined', body: name ? `${actor} joined ${name}.` : `${actor} joined a trip.` }
    default: {
      const eventLabel = textValue(eventType).replaceAll('_', ' ')
      return {
        title: 'Trip update',
        body: withTrip(eventLabel ? `${actor} recorded a ${eventLabel} update` : `${actor} made an update`, name),
      }
    }
  }
}

export const PUSH_CHANNELS = Object.freeze({
  audible: 'contri_updates_v2',
  silent: 'contri_updates_silent_v2',
})

export const getPushChannelForPreference = (soundEnabled) => soundEnabled === true ? PUSH_CHANNELS.audible : PUSH_CHANNELS.silent
