import { fromMinorUnits, getCurrencyFractionDigits, parseMinorUnits, toMinorUnits } from './money.js'

const normalizeMembers = (splitAmong = []) => {
  const seen = new Set()
  return splitAmong.filter((item) => {
    if (!item?.uid || seen.has(item.uid)) return false
    seen.add(item.uid)
    return true
  })
}

const parseWeight = (value) => {
  const hundredths = parseMinorUnits(value, 'INR')
  return hundredths === null || hundredths < 0 ? 0 : BigInt(hundredths)
}

const allocateEqually = (total, participants, currency) => {
  const quotient = Math.floor(total / participants.length)
  const remainder = total - quotient * participants.length
  return participants.map(({ uid }, index) => ({
    uid,
    amount: fromMinorUnits(quotient + (index < remainder ? 1 : 0), currency),
  }))
}

const allocateWeightedMinorUnits = (total, participants, weights, currency) => {
  const sign = total < 0 ? -1n : 1n
  const totalBig = BigInt(Math.abs(total))
  const sumWeights = weights.reduce((sum, value) => sum + value, 0n)
  if (!sumWeights) return allocateEqually(total, participants, currency)
  const allocations = weights.map((weight, index) => {
    const numerator = totalBig * weight
    return { uid: participants[index].uid, minor: numerator / sumWeights, remainder: numerator % sumWeights, index }
  })
  const allocated = allocations.reduce((sum, item) => sum + item.minor, 0n)
  const extraUnits = Number(totalBig - allocated)
  const order = [...allocations].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : (a.remainder > b.remainder ? -1 : 1))
  for (let index = 0; index < extraUnits; index += 1) order[index].minor += 1n
  return allocations.map((item) => ({ uid: item.uid, amount: fromMinorUnits(Number(item.minor * sign), currency) }))
}

export const resolveSplitAmounts = ({ amount, splitMode, splitAmong, currency = 'INR' }) => {
  const total = toMinorUnits(amount, currency)
  const participants = normalizeMembers(splitAmong)
  if (!participants.length) return []

  if (splitMode === 'equal') {
    return allocateEqually(total, participants, currency)
  }

  if (splitMode === 'percentage' || splitMode === 'shares') {
    const weights = participants.map((item) => parseWeight(item.value))
    return allocateWeightedMinorUnits(total, participants, weights, currency)
  }

  // Legacy exact/custom records: honor earlier entries and reconcile rounding/legacy drift
  // to the final participant. New writes must pass exact-share validation before saving.
  let assigned = 0
  return participants.map((item, index) => {
    const next = index === participants.length - 1
      ? total - assigned
      : toMinorUnits(item.value, currency)
    assigned += next
    return { uid: item.uid, amount: fromMinorUnits(next, currency) }
  })
}

export const getSelectedMemberIds = (members = [], splitAmong = []) =>
  splitAmong?.length ? [...new Set(splitAmong.map((item) => item.uid).filter(Boolean))] : members.map((member) => member.uid)

export const getSplitValueMap = (members = [], splitMode = 'equal', splitAmong = []) => {
  const values = {}
  members.forEach((member) => { values[member.uid] = splitMode === 'equal' ? '1' : '' })
  splitAmong.forEach((item) => { values[item.uid] = String(item.value ?? '') })
  return values
}

export const validateSplitConfig = ({ amount, currency = 'INR', splitMode, selectedMemberIds = [], splitValues = {} }) => {
  const totalMinor = parseMinorUnits(amount, currency)
  if (totalMinor === null || totalMinor <= 0) return { valid: false, message: 'Enter a valid expense amount.' }
  if (!selectedMemberIds.length) return { valid: false, message: 'Select at least one member for the split.' }
  if (new Set(selectedMemberIds).size !== selectedMemberIds.length || selectedMemberIds.some((uid) => !uid)) {
    return { valid: false, message: 'Each trip member can only appear once in the split.' }
  }

  if (splitMode === 'percentage') {
    const parsed = selectedMemberIds.map((uid) => parseMinorUnits(splitValues[uid], 'INR'))
    if (parsed.some((value) => value === null || value < 0)) {
      return { valid: false, message: 'Enter a valid percentage for each selected member.' }
    }
    const values = parsed.map(BigInt)
    if (values.reduce((sum, value) => sum + value, 0n) !== 10000n) {
      return { valid: false, message: 'Percentage split must total exactly 100%.' }
    }
  }

  if (splitMode === 'exact') {
    const shares = selectedMemberIds.map((uid) => parseMinorUnits(splitValues[uid], currency))
    if (shares.some((value) => value === null || value < 0)) return { valid: false, message: 'Enter a valid non-negative share for each member.' }
    if (shares.reduce((sum, value) => sum + value, 0) !== totalMinor) {
      return { valid: false, message: 'Exact split must equal the full expense amount.' }
    }
  }

  if (splitMode === 'shares') {
    const parsed = selectedMemberIds.map((uid) => parseMinorUnits(splitValues[uid], 'INR'))
    if (parsed.some((value) => value === null || value < 0)) {
      return { valid: false, message: 'Enter valid share units for each selected member.' }
    }
    const values = parsed.map(BigInt)
    if (values.reduce((sum, value) => sum + value, 0n) <= 0n) return { valid: false, message: 'Share units must add up to more than 0.' }
  }

  return { valid: true }
}

export const buildSplitAmongPayload = ({ splitMode, selectedMemberIds, splitValues, currency = 'INR' }) =>
  selectedMemberIds.map((uid) => ({
    uid,
    value: splitMode === 'equal'
      ? 1
      : splitMode === 'exact'
        ? fromMinorUnits(toMinorUnits(splitValues[uid], currency), currency)
        : fromMinorUnits(parseMinorUnits(splitValues[uid], 'INR') ?? 0, 'INR'),
  }))

export const getSplitValuePrecision = (currency = 'INR') => getCurrencyFractionDigits(currency)

export const splitRemainderNote = 'Any indivisible minor units go to selected participants in selection order.'
