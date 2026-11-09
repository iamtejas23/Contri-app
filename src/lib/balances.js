import { activeAdvanceRecords } from './advances.js'
import { EXPENSE_CATEGORIES, LEGACY_CATEGORIES } from './constants.js'
import { formatTimelineDate, toDateValue } from './date.js'
import { fromMinorUnits, toMinorUnits } from './money.js'
import { resolveSplitAmounts } from './splits.js'

export const buildMembersMap = (members = []) =>
  members.reduce((accumulator, member) => {
    accumulator[member.uid] = member
    return accumulator
  }, {})

const amountMinor = (amount, currency) => toMinorUnits(amount, currency)
const appendUnknownMember = (ledger, uid, name = 'Unknown member') => {
  if (!uid || ledger[uid]) return
  ledger[uid] = { uid, name, email: '', role: 'member', paidMinor: 0, shareMinor: 0, settledInMinor: 0, settledOutMinor: 0, advanceMinor: 0, advanceHeldMinor: 0 }
}

export const computeBalances = ({ trip, expenses = [], settlements = [], advances = [] }) => {
  const currency = trip?.currency || 'INR'
  const members = trip?.members || []
  const ledger = members.reduce((accumulator, member) => {
    accumulator[member.uid] = {
      uid: member.uid, name: member.name, email: member.email, role: member.role,
      paidMinor: 0, shareMinor: 0, settledInMinor: 0, settledOutMinor: 0, advanceMinor: 0, advanceHeldMinor: 0,
    }
    return accumulator
  }, {})

  expenses.forEach((expense, index) => {
    const amount = amountMinor(expense.amount, currency)
    if (!amount) return
    const paidBy = expense.paidBy || `unknown-payer:${expense.id || index}`
    appendUnknownMember(ledger, paidBy, expense.paidBy ? 'Unknown member' : 'Unknown payer')
    ledger[paidBy].paidMinor += amount

    // Older records without explicit participants are interpreted as an equal split
    // across the trip roster, matching the original create-expense default.
    const splitAmong = expense.splitAmong?.length
      ? expense.splitAmong
      : members.map(({ uid }) => ({ uid, value: 1 }))
    const shares = resolveSplitAmounts({
      amount: fromMinorUnits(amount, currency),
      currency,
      splitMode: expense.splitMode || 'equal',
      splitAmong,
    })
    shares.forEach((share) => {
      appendUnknownMember(ledger, share.uid)
      ledger[share.uid].shareMinor += amountMinor(share.amount, currency)
    })
  })

  settlements.forEach((settlement) => {
    const amount = amountMinor(settlement.amount, currency)
    if (!amount) return
    appendUnknownMember(ledger, settlement.from)
    appendUnknownMember(ledger, settlement.to)
    if (ledger[settlement.from]) ledger[settlement.from].settledOutMinor += amount
    if (ledger[settlement.to]) ledger[settlement.to].settledInMinor += amount
  })

  activeAdvanceRecords(advances).forEach((advance) => {
    appendUnknownMember(ledger, advance.memberUid)
    appendUnknownMember(ledger, advance.recordedBy, 'Advance holder')
    if (ledger[advance.memberUid]) ledger[advance.memberUid].advanceMinor += advance.amountPaise
    if (ledger[advance.recordedBy]) ledger[advance.recordedBy].advanceHeldMinor += advance.amountPaise
  })

  const expenseMinor = expenses.reduce((sum, expense) => sum + amountMinor(expense.amount, currency), 0)

  return Object.values(ledger)
    .map((entry) => {
      const advanceEffect = expenseMinor > 0 ? entry.advanceMinor - entry.advanceHeldMinor : 0
      const netMinor = entry.paidMinor - entry.shareMinor + entry.settledOutMinor - entry.settledInMinor + advanceEffect
      return {
        uid: entry.uid,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        paid: fromMinorUnits(entry.paidMinor, currency),
        share: fromMinorUnits(entry.shareMinor, currency),
        settledIn: fromMinorUnits(entry.settledInMinor, currency),
        settledOut: fromMinorUnits(entry.settledOutMinor, currency),
        advance: fromMinorUnits(entry.advanceMinor, currency),
        remainingContribution: fromMinorUnits(entry.shareMinor - entry.advanceMinor, currency),
        net: fromMinorUnits(netMinor, currency),
      }
    })
    .sort((first, second) => second.net - first.net)
}

export const computeSettlementSuggestions = (balances = [], currency = 'INR') => {
  const creditors = balances
    .map((entry) => ({ uid: entry.uid, minor: toMinorUnits(entry.net, currency) }))
    .filter((entry) => entry.minor > 0)
    .sort((first, second) => second.minor - first.minor || first.uid.localeCompare(second.uid))
  const debtors = balances
    .map((entry) => ({ uid: entry.uid, minor: -toMinorUnits(entry.net, currency) }))
    .filter((entry) => entry.minor > 0)
    .sort((first, second) => second.minor - first.minor || first.uid.localeCompare(second.uid))

  const suggestions = []
  let debtorIndex = 0
  let creditorIndex = 0
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const minor = Math.min(debtor.minor, creditor.minor)
    if (minor > 0) suggestions.push({ from: debtor.uid, to: creditor.uid, amount: fromMinorUnits(minor, currency) })
    debtor.minor -= minor
    creditor.minor -= minor
    if (!debtor.minor) debtorIndex += 1
    if (!creditor.minor) creditorIndex += 1
  }
  return suggestions
}

export const buildDashboardMetrics = ({ trip, expenses = [], settlements = [], advances = [], currentUserId }) => {
  const currency = trip?.currency || 'INR'
  const members = trip?.members || []
  const balances = computeBalances({ trip, expenses, settlements, advances })
  const totalSpentMinor = expenses.reduce((sum, item) => sum + amountMinor(item.amount, currency), 0)
  const totalSpent = fromMinorUnits(totalSpentMinor, currency)
  const averagePerPerson = members.length
    ? fromMinorUnits(Math.round(totalSpentMinor / members.length), currency)
    : 0
  const yourBalance = balances.find((entry) => entry.uid === currentUserId)
  const categoryMinor = [...EXPENSE_CATEGORIES, ...LEGACY_CATEGORIES].reduce((result, category) => ({ ...result, [category]: 0 }), {})
  const dailyMinor = {}
  const contributionMinor = members.reduce((result, member) => ({ ...result, [member.uid]: 0 }), {})

  expenses.forEach((expense) => {
    const amount = amountMinor(expense.amount, currency)
    categoryMinor[expense.category] = (categoryMinor[expense.category] || 0) + amount
    const expenseDate = expense.date || toDateValue(expense.createdAt)?.toISOString().slice(0, 10)
    if (expenseDate) dailyMinor[expenseDate] = (dailyMinor[expenseDate] || 0) + amount
    if (Object.hasOwn(contributionMinor, expense.paidBy)) contributionMinor[expense.paidBy] += amount
  })

  const contributionsData = members.map((member) => ({
    uid: member.uid, name: member.name, amount: fromMinorUnits(contributionMinor[member.uid] || 0, currency),
    ...(balances.find((entry) => entry.uid === member.uid) || {}),
  }))
  const topSpender = [...contributionsData].sort((a, b) => amountMinor(b.amount, currency) - amountMinor(a.amount, currency))[0]
  const mostOwed = [...balances].sort((a, b) => b.net - a.net)[0]
  const budgetMinor = amountMinor(trip?.budget, currency)
  const settledMinor = settlements.reduce((sum, settlement) => sum + amountMinor(settlement.amount, currency), 0)
  const outstandingMinor = balances.reduce((sum, entry) => sum + Math.max(0, amountMinor(entry.net, currency)), 0)
  const yourNetMinor = amountMinor(yourBalance?.net || 0, currency)

  return {
    balances,
    suggestions: computeSettlementSuggestions(balances, currency),
    totalSpent,
    budget: fromMinorUnits(budgetMinor, currency),
    budgetLeft: budgetMinor ? fromMinorUnits(budgetMinor - totalSpentMinor, currency) : null,
    averagePerPerson,
    yourPaid: yourBalance?.paid || 0,
    yourShare: yourBalance?.share || 0,
    yourSettledIn: yourBalance?.settledIn || 0,
    yourSettledOut: yourBalance?.settledOut || 0,
    yourNet: yourBalance?.net || 0,
    yourOwed: yourNetMinor < 0 ? fromMinorUnits(-yourNetMinor, currency) : 0,
    yourReceivable: yourNetMinor > 0 ? fromMinorUnits(yourNetMinor, currency) : 0,
    settledAmount: fromMinorUnits(settledMinor, currency),
    outstandingAmount: fromMinorUnits(outstandingMinor, currency),
    topSpender,
    mostOwed,
    categoryData: Object.entries(categoryMinor)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value: fromMinorUnits(value, currency) })),
    dailyData: Object.entries(dailyMinor)
      .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
      .map(([date, value]) => ({ date, label: formatTimelineDate(date), value: fromMinorUnits(value, currency) })),
    contributionsData,
  }
}
