import { CURRENCIES } from './constants.js'
import { formatCurrency, getCurrencyFractionDigits } from './money.js'

export { formatCurrency, getCurrencyFractionDigits }

export const getCurrencyMeta = (code = 'INR') =>
  CURRENCIES.find((currency) => currency.code === code) || CURRENCIES[0]

export const currencySymbol = (currency = 'INR') => {
  const sample = formatCurrency(0, currency)
  return sample.replace(/[0\s.,]/g, '') || currency
}
