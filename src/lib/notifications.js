export const expenseNotificationId = (tripId, expenseId) => `${tripId}_${expenseId}`

export const buildExpenseNotification = ({
  tripId,
  tripName,
  expenseId,
  recipientUid,
  actor,
  expense,
}) => ({
  type: 'expense_created',
  tripId,
  tripName,
  expenseId,
  recipientUid,
  actorUid: actor.uid,
  actorName: actor.name || 'A trip member',
  ...(actor.photoURL ? { actorPhotoURL: actor.photoURL } : {}),
  expenseTitle: expense.title,
  amount: expense.amount,
  currency: expense.currency,
  read: false,
})

export const countUnreadNotifications = (notifications = []) =>
  notifications.reduce((count, notification) => count + (notification.read === false ? 1 : 0), 0)
