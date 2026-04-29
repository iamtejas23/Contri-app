import { roundCurrency, toNumber } from './utils'

const normalizeMembers = (splitAmong = []) =>
  splitAmong
    .filter((item) => item?.uid)
    .map((item) => ({
      uid: item.uid,
      value: roundCurrency(toNumber(item.value)),
    }))

const applyRemainder = (items, amount, mapper) => {
  const result = []
  let runningTotal = 0

  items.forEach((item, index) => {
    const isLast = index === items.length - 1
    const nextAmount = isLast
      ? roundCurrency(amount - runningTotal)
      : roundCurrency(mapper(item))

    runningTotal += nextAmount
    result.push({ uid: item.uid, amount: nextAmount })
  })

  return result
}

export const resolveSplitAmounts = ({ amount, splitMode, splitAmong }) => {
  const safeAmount = roundCurrency(toNumber(amount))
  const participants = normalizeMembers(splitAmong)

  if (!participants.length) {
    return []
  }

  if (splitMode === 'equal') {
    const equalAmount = safeAmount / participants.length
    return applyRemainder(participants, safeAmount, () => equalAmount)
  }

  if (splitMode === 'percentage') {
    return applyRemainder(participants, safeAmount, (item) => (safeAmount * item.value) / 100)
  }

  if (splitMode === 'shares') {
    const totalShares = participants.reduce((sum, item) => sum + item.value, 0)
    return applyRemainder(participants, safeAmount, (item) =>
      totalShares ? (safeAmount * item.value) / totalShares : 0,
    )
  }

  return applyRemainder(participants, safeAmount, (item) => item.value)
}

export const getSelectedMemberIds = (members = [], splitAmong = []) => {
  if (splitAmong?.length) {
    return splitAmong.map((item) => item.uid)
  }

  return members.map((member) => member.uid)
}

export const getSplitValueMap = (members = [], splitMode = 'equal', splitAmong = []) => {
  const values = {}

  members.forEach((member) => {
    values[member.uid] = splitMode === 'equal' ? '1' : ''
  })

  splitAmong.forEach((item) => {
    values[item.uid] = String(item.value ?? '')
  })

  return values
}

export const validateSplitConfig = ({
  amount,
  splitMode,
  selectedMemberIds,
  splitValues,
}) => {
  const safeAmount = roundCurrency(toNumber(amount))

  if (safeAmount <= 0) {
    return { valid: false, message: 'Enter a valid expense amount.' }
  }

  if (!selectedMemberIds.length) {
    return { valid: false, message: 'Select at least one member for the split.' }
  }

  if (splitMode === 'percentage') {
    const total = roundCurrency(
      selectedMemberIds.reduce((sum, uid) => sum + toNumber(splitValues[uid]), 0),
    )

    if (Math.abs(total - 100) > 0.01) {
      return { valid: false, message: 'Percentage split must total 100%.' }
    }
  }

  if (splitMode === 'exact') {
    const total = roundCurrency(
      selectedMemberIds.reduce((sum, uid) => sum + toNumber(splitValues[uid]), 0),
    )

    if (Math.abs(total - safeAmount) > 0.01) {
      return { valid: false, message: 'Exact split must equal the full expense amount.' }
    }
  }

  if (splitMode === 'shares') {
    const totalShares = roundCurrency(
      selectedMemberIds.reduce((sum, uid) => sum + toNumber(splitValues[uid]), 0),
    )

    if (totalShares <= 0) {
      return { valid: false, message: 'Share units must add up to more than 0.' }
    }
  }

  return { valid: true }
}

export const buildSplitAmongPayload = ({
  splitMode,
  selectedMemberIds,
  splitValues,
}) =>
  selectedMemberIds.map((uid) => ({
    uid,
    value:
      splitMode === 'equal'
        ? 1
        : roundCurrency(toNumber(splitValues[uid])),
  }))
