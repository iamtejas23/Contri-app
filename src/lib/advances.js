import { parseMinorUnits } from './money.js'

export const MAX_ADVANCE_PAISE = 100_000_000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const isAdvancePaymentDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export const validateAdvanceInput = ({
  memberUid,
  amount,
  paymentDate,
  reference = '',
  note = '',
  memberIds = [],
  currency = 'INR',
}) => {
  if (!memberUid || !memberIds.includes(memberUid)) {
    return { valid: false, error: 'Choose a current member of this trip.' }
  }
  const amountPaise = parseMinorUnits(amount, currency)
  if (amountPaise === null || amountPaise <= 0) {
    return { valid: false, error: 'Enter an advance amount greater than zero.' }
  }
  if (amountPaise > MAX_ADVANCE_PAISE) {
    return { valid: false, error: 'Advance cannot exceed ₹10,00,000.' }
  }
  if (!isAdvancePaymentDate(paymentDate)) {
    return { valid: false, error: 'Choose the date this advance was paid.' }
  }
  const safeReference = String(reference || '').trim()
  const safeNote = String(note || '').trim()
  if (safeReference.length > 80) return { valid: false, error: 'Payment reference must be 80 characters or less.' }
  if (safeNote.length > 280) return { valid: false, error: 'Note must be 280 characters or less.' }
  return {
    valid: true,
    value: {
      memberUid,
      amountPaise,
      paymentDate,
      reference: safeReference,
      note: safeNote,
    },
  }
}

const reversalTargets = (advances = []) => new Set(
  advances.filter((entry) => entry?.status === 'reversal' && entry.reversalOf).map((entry) => entry.reversalOf),
)

export const isActiveRecordedAdvance = (entry, advances = []) => {
  const amount = Number(entry?.amountPaise)
  return entry?.status === 'recorded'
    && !entry?.reversalId
    && !reversalTargets(advances).has(entry?.id)
    && Number.isSafeInteger(amount)
    && amount > 0
}

export const activeAdvanceRecords = (advances = []) => (
  advances.filter((entry) => isActiveRecordedAdvance(entry, advances))
)

export const summarizeAdvances = ({ members = [], advances = [] }) => {
  const contributed = new Map()
  const held = new Map()
  activeAdvanceRecords(advances).forEach((entry) => {
    contributed.set(entry.memberUid, (contributed.get(entry.memberUid) || 0) + entry.amountPaise)
    if (entry.recordedBy) held.set(entry.recordedBy, (held.get(entry.recordedBy) || 0) + entry.amountPaise)
  })
  const memberIds = new Set(members.map((member) => member.uid))
  let totalPaise = 0
  let contributedCount = 0
  memberIds.forEach((uid) => {
    const amount = contributed.get(uid) || 0
    totalPaise += amount
    if (amount > 0) contributedCount += 1
  })
  return {
    totalPaise,
    contributedCount,
    pendingCount: Math.max(0, memberIds.size - contributedCount),
    contributed,
    held,
  }
}

export const advanceStatusForMember = ({ advancePaise = 0, sharePaise = 0 }) => {
  if (advancePaise <= 0) return { id: 'none', label: 'No advance recorded' }
  if (sharePaise > 0 && advancePaise < sharePaise) return { id: 'partial', label: 'Partially contributed' }
  if (sharePaise > 0 && advancePaise === sharePaise) return { id: 'covered', label: 'Fully covered' }
  return { id: 'credit', label: 'Additional advance credit' }
}
