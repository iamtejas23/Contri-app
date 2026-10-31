import { parseMinorUnits } from './money.js'
import { validateSplitConfig } from './splits.js'
import { SETTLEMENT_METHODS, SPLIT_MODES } from './constants.js'

export const validateExpenseForWrite = ({ values, currency = 'INR', memberIds }) => {
  const amount = parseMinorUnits(values?.amount, currency)
  if (amount === null || amount <= 0) return { valid: false, message: 'Expense amount must be greater than zero.' }
  if (!String(values?.title || '').trim()) return { valid: false, message: 'Expense title is required.' }
  if (!values?.paidBy) return { valid: false, message: 'Choose who paid for this expense.' }
  if (!SPLIT_MODES.some((mode) => mode.value === (values.splitMode || 'equal'))) return { valid: false, message: 'Choose a supported split method.' }
  if (memberIds && !memberIds.includes(values.paidBy)) return { valid: false, message: 'The payer must be a member of this trip.' }

  const splitAmong = Array.isArray(values.splitAmong) ? values.splitAmong : []
  const participantIds = splitAmong.map((item) => item?.uid)
  if (memberIds && participantIds.some((uid) => !memberIds.includes(uid))) {
    return { valid: false, message: 'Only current trip members can be included in an expense split.' }
  }
  const splitValues = Object.fromEntries(splitAmong.map((item) => [item.uid, String(item.value ?? '')]))
  return validateSplitConfig({
    amount: values.amount,
    currency,
    splitMode: values.splitMode || 'equal',
    selectedMemberIds: participantIds,
    splitValues,
  })
}

export const validateSettlementForWrite = ({ values, currency = 'INR', memberIds }) => {
  const amount = parseMinorUnits(values?.amount, currency)
  if (amount === null || amount <= 0) return { valid: false, message: 'Settlement amount must be greater than zero.' }
  if (!values?.from || !values?.to || values.from === values.to) {
    return { valid: false, message: 'Choose two different trip members for this settlement.' }
  }
  if (memberIds && (!memberIds.includes(values.from) || !memberIds.includes(values.to))) {
    return { valid: false, message: 'Both settlement members must belong to this trip.' }
  }
  if (!SETTLEMENT_METHODS.some((method) => method.value === values.method)) {
    return { valid: false, message: 'Choose a supported settlement method.' }
  }
  return { valid: true }
}

export const assertFinanciallyValid = (result) => {
  if (!result.valid) throw new Error(result.message)
}
