export const buildExpenseCreationActivityMap = (activity = []) =>
  activity.reduce((map, item) => {
    const expenseId = item?.meta?.expenseId
    if (item?.type === 'expense_created' && expenseId && item.actorUid) {
      if (!(expenseId in map)) {
        map[expenseId] = item
      } else if (map[expenseId]?.actorUid !== item.actorUid) {
        map[expenseId] = null
      }
    }
    return map
  }, {})

export const resolveExpenseCreator = (expense, membersMap = {}, creationActivityMap = {}) => {
  const creationActivity = creationActivityMap[expense?.id]
  const uid = expense?.createdBy || creationActivity?.actorUid || ''
  const member = uid ? membersMap[uid] : null
  const activityMatchesCreator = Boolean(uid && creationActivity?.actorUid === uid)

  return {
    uid,
    name: member?.name || (activityMatchesCreator ? creationActivity?.actorName : '') || 'Unknown member',
    photoURL: member?.photoURL || '',
  }
}
