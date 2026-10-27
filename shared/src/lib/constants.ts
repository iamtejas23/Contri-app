export const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'AED', label: 'UAE Dirham' },
] as const

export const EXPENSE_CATEGORIES = [
  'Food',
  'Petrol',
  'Toll',
  'Hotel',
  'Travel',
  'Activity',
  'Shopping',
  'Other',
] as const

export const LEGACY_CATEGORIES = ['Stay'] as const

export const TRIP_EMOJIS = [
  '🏝️',
  '🏔️',
  '🏕️',
  '🚗',
  '🚆',
  '✈️',
  '🛳️',
  '🏙️',
  '🌋',
  '🌴',
  '🍜',
  '📸',
] as const

export const SPLIT_MODES = [
  { value: 'equal', label: 'Equal', helper: 'Split evenly among selected members.' },
  {
    value: 'percentage',
    label: 'Percentage',
    helper: 'Percentages must add up to 100.',
  },
  { value: 'exact', label: 'Exact', helper: 'Exact amounts must match the bill total.' },
  { value: 'shares', label: 'Shares', helper: 'Use share units and auto-calculate the rest.' },
] as const

export const SETTLEMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
] as const

export const DEFAULT_TRIP_FORM = {
  name: '',
  description: '',
  emoji: '🏝️',
  startDate: '',
  endDate: '',
  currency: 'INR',
  budget: '',
}

const defaultDate = new Date().toISOString().slice(0, 10)

export const DEFAULT_EXPENSE_FORM = {
  title: '',
  amount: '',
  category: 'Food',
  paidBy: '',
  date: defaultDate,
  note: '',
  splitMode: 'equal' as const,
  receiptURL: '',
}

export const BRAND_LINE = 'Trip khatam. Hisab bhi khatam.'

export const CATEGORY_DETAILS: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  Food: { emoji: '🍛', label: 'Food', color: '#C2410C' },
  Petrol: { emoji: '⛽', label: 'Petrol', color: '#92400E' },
  Toll: { emoji: '🛣️', label: 'Toll', color: '#0369A1' },
  Hotel: { emoji: '🏨', label: 'Hotel', color: '#4338CA' },
  Stay: { emoji: '🏨', label: 'Stay', color: '#4338CA' },
  Travel: { emoji: '🚆', label: 'Travel', color: '#0F766E' },
  Activity: { emoji: '🎟️', label: 'Activity', color: '#A16207' },
  Shopping: { emoji: '🛍️', label: 'Shopping', color: '#7E22CE' },
  Other: { emoji: '📦', label: 'Other', color: '#475569' },
}

export const getCategoryMeta = (category: string) =>
  CATEGORY_DETAILS[category] || {
    emoji: '🧾',
    label: category || 'Other',
    color: '#475569',
  }
