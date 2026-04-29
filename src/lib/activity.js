import { serverTimestamp } from 'firebase/firestore'

import { formatCurrency } from './currency'

export const ACTIVITY_TYPES = {
  EXPENSE_CREATED: 'expense_created',
  EXPENSE_UPDATED: 'expense_updated',
  EXPENSE_DELETED: 'expense_deleted',
  SETTLEMENT_CREATED: 'settlement_created',
}

export const createActivityPayload = ({ type, actor, message, meta = {} }) => ({
  type,
  actorUid: actor.uid,
  actorName: actor.name,
  actorEmail: actor.email,
  message,
  meta,
  timestamp: serverTimestamp(),
})

export const getActivityText = (activity, membersMap, currency) => {
  const actorName = activity.actorName || membersMap?.[activity.actorUid]?.name || 'Someone'
  const amount = activity.meta?.amount ? formatCurrency(activity.meta.amount, currency) : null

  if (activity.message) {
    return activity.message
      .replace('{actor}', actorName)
      .replace('{title}', activity.meta?.title || 'an expense')
      .replace('{amount}', amount || '')
      .replace('{from}', membersMap?.[activity.meta?.from]?.name || 'Someone')
      .replace('{to}', membersMap?.[activity.meta?.to]?.name || 'Someone')
  }

  return actorName
}
