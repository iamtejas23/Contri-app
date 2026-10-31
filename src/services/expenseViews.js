import { collection, collectionGroup, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'

/** Create one immutable view receipt per member and expense. */
export const recordExpenseView = async ({ database, tripId, expenseId, viewerUid, creatorUid }) => {
  // A legacy expense with no resolvable creator must not create a receipt: we
  // cannot prove that the current viewer is not its creator.
  if (!database || !tripId || !expenseId || !viewerUid || !creatorUid || viewerUid === creatorUid) return false

  const expenseRef = doc(database, 'trips', tripId, 'expenses', expenseId)
  const viewRef = doc(collection(database, 'trips', tripId, 'expenses', expenseId, 'seenBy'), viewerUid)
  return runTransaction(database, async (transaction) => {
    const [existingView, expense] = await Promise.all([
      transaction.get(viewRef),
      transaction.get(expenseRef),
    ])
    if (existingView.exists() || !expense.exists()) return false
    if (expense.data().createdBy === viewerUid) return false

    transaction.set(viewRef, {
      tripId,
      expenseId,
      uid: viewerUid,
      viewedAt: serverTimestamp(),
    })
    return true
  })
}

/** One trip-scoped collection-group listener covers every expense card. */
export const subscribeToTripExpenseViews = ({ database, tripId, onViews, onError }) => {
  const viewsQuery = query(collectionGroup(database, 'seenBy'), where('tripId', '==', tripId))
  return onSnapshot(viewsQuery, (snapshot) => {
    const byExpense = {}
    snapshot.docs.forEach((item) => {
      const view = { id: item.id, ...item.data() }
      if (!byExpense[view.expenseId]) byExpense[view.expenseId] = []
      byExpense[view.expenseId].push(view)
    })
    onViews(byExpense)
  }, onError)
}

export const sortExpenseViews = (views = []) => [...views].sort((left, right) => {
  const leftTime = left.viewedAt?.toMillis?.() ?? left.viewedAt?.getTime?.() ?? 0
  const rightTime = right.viewedAt?.toMillis?.() ?? right.viewedAt?.getTime?.() ?? 0
  return leftTime - rightTime || String(left.uid).localeCompare(String(right.uid))
})
