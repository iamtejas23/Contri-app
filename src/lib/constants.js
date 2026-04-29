export const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'AED', label: 'UAE Dirham' },
]

export const EXPENSE_CATEGORIES = [
  'Food',
  'Travel',
  'Stay',
  'Activity',
  'Shopping',
  'Other',
]

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
]

export const SPLIT_MODES = [
  { value: 'equal', label: 'Equal', helper: 'Split evenly among selected members.' },
  {
    value: 'percentage',
    label: 'Percentage',
    helper: 'Percentages must add up to 100.',
  },
  { value: 'exact', label: 'Exact', helper: 'Exact amounts must match the bill total.' },
  { value: 'shares', label: 'Shares', helper: 'Use share units and auto-calculate the rest.' },
]

export const SETTLEMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
]

export const DEFAULT_TRIP_FORM = {
  name: '',
  description: '',
  emoji: '🏝️',
  startDate: '',
  endDate: '',
  currency: 'INR',
}

export const DEFAULT_EXPENSE_FORM = {
  title: '',
  amount: '',
  category: 'Food',
  paidBy: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
  splitMode: 'equal',
  receiptFile: null,
  receiptURL: '',
}
