import { CURRENCIES } from './constants'
import { roundCurrency, toNumber } from './utils'

export const getCurrencyMeta = (code = 'INR') =>
  CURRENCIES.find((currency) => currency.code === code) || CURRENCIES[0]

export const formatCurrency = (amount, currency = 'INR') => {
  const safeAmount = roundCurrency(toNumber(amount))

  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(safeAmount)
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`
  }
}

export const currencySymbol = (currency = 'INR') => {
  const sample = formatCurrency(0, currency)
  return sample.replace(/[0\s.,]/g, '') || currency
}
