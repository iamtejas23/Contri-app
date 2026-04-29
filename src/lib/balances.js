import { EXPENSE_CATEGORIES } from './constants'
import { formatTimelineDate } from './date'
import { resolveSplitAmounts } from './splits'
import { roundCurrency, toNumber } from './utils'

export const buildMembersMap = (members = []) =>
  members.reduce((accumulator, member) => {
    accumulator[member.uid] = member
    return accumulator
  }, {})

export const computeBalances = ({ trip, expenses = [], settlements = [] }) => {
  const members = trip?.members || []
  const ledger = members.reduce((accumulator, member) => {
    accumulator[member.uid] = {
      uid: member.uid,
      name: member.name,
      email: member.email,
      role: member.role,
      paid: 0,
      share: 0,
      settledIn: 0,
      settledOut: 0,
      net: 0,
    }
    return accumulator
  }, {})

  expenses.forEach((expense) => {
    const amount = roundCurrency(toNumber(expense.amount))
    const paidBy = expense.paidBy

    if (!ledger[paidBy]) {
      return
    }

    ledger[paidBy].paid += amount

    const shares = resolveSplitAmounts({
      amount,
      splitMode: expense.splitMode,
      splitAmong: expense.splitAmong,
    })

    shares.forEach((item) => {
      if (!ledger[item.uid]) {
        return
      }

      ledger[item.uid].share += item.amount
    })
  })

  settlements.forEach((settlement) => {
    const amount = roundCurrency(toNumber(settlement.amount))

    if (ledger[settlement.from]) {
      ledger[settlement.from].settledOut += amount
    }

    if (ledger[settlement.to]) {
      ledger[settlement.to].settledIn += amount
    }
  })

  return Object.values(ledger)
    .map((entry) => ({
      ...entry,
      paid: roundCurrency(entry.paid),
      share: roundCurrency(entry.share),
      settledIn: roundCurrency(entry.settledIn),
      settledOut: roundCurrency(entry.settledOut),
      net: roundCurrency(entry.paid - entry.share + entry.settledOut - entry.settledIn),
    }))
    .sort((first, second) => second.net - first.net)
}

export const computeSettlementSuggestions = (balances = []) => {
  const creditors = balances
    .filter((entry) => entry.net > 0.01)
    .map((entry) => ({ uid: entry.uid, amount: entry.net }))
    .sort((first, second) => second.amount - first.amount)

  const debtors = balances
    .filter((entry) => entry.net < -0.01)
    .map((entry) => ({ uid: entry.uid, amount: Math.abs(entry.net) }))
    .sort((first, second) => second.amount - first.amount)

  const suggestions = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = roundCurrency(Math.min(debtor.amount, creditor.amount))

    suggestions.push({
      from: debtor.uid,
      to: creditor.uid,
      amount,
    })

    debtor.amount = roundCurrency(debtor.amount - amount)
    creditor.amount = roundCurrency(creditor.amount - amount)

    if (debtor.amount <= 0.01) {
      debtorIndex += 1
    }

    if (creditor.amount <= 0.01) {
      creditorIndex += 1
    }
  }

  return suggestions
}

export const buildDashboardMetrics = ({
  trip,
  expenses = [],
  settlements = [],
  currentUserId,
}) => {
  const members = trip?.members || []
  const balances = computeBalances({ trip, expenses, settlements })
  const totalSpent = roundCurrency(expenses.reduce((sum, item) => sum + toNumber(item.amount), 0))
  const averagePerPerson = members.length ? roundCurrency(totalSpent / members.length) : 0
  const yourBalance = balances.find((entry) => entry.uid === currentUserId)
  const categoryMap = EXPENSE_CATEGORIES.reduce((accumulator, category) => {
    accumulator[category] = 0
    return accumulator
  }, {})
  const dailyMap = {}
  const contributionMap = members.reduce((accumulator, member) => {
    accumulator[member.uid] = {
      uid: member.uid,
      name: member.name,
      amount: 0,
    }
    return accumulator
  }, {})

  expenses.forEach((expense) => {
    const amount = roundCurrency(toNumber(expense.amount))
    categoryMap[expense.category] = roundCurrency((categoryMap[expense.category] || 0) + amount)
    dailyMap[expense.date] = roundCurrency((dailyMap[expense.date] || 0) + amount)

    if (contributionMap[expense.paidBy]) {
      contributionMap[expense.paidBy].amount = roundCurrency(
        contributionMap[expense.paidBy].amount + amount,
      )
    }
  })

  const topSpender = Object.values(contributionMap).sort((first, second) => second.amount - first.amount)[0]
  const mostOwed = [...balances].sort((first, second) => second.net - first.net)[0]

  return {
    balances,
    suggestions: computeSettlementSuggestions(balances),
    totalSpent,
    averagePerPerson,
    yourShare: yourBalance?.share || 0,
    yourNet: yourBalance?.net || 0,
    topSpender,
    mostOwed,
    categoryData: Object.entries(categoryMap)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value })),
    dailyData: Object.entries(dailyMap)
      .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
      .map(([date, value]) => ({
        date,
        label: formatTimelineDate(date),
        value,
      })),
    contributionsData: Object.values(contributionMap),
  }
}
