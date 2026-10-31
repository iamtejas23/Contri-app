const fractionDigitsCache = new Map()

export const getCurrencyFractionDigits = (currency = 'INR') => {
  const code = String(currency || 'INR').toUpperCase()
  if (fractionDigitsCache.has(code)) return fractionDigitsCache.get(code)
  let digits = 2
  try {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits
  } catch {
    // Unknown legacy currency values retain the app's historical two-decimal behavior.
  }
  fractionDigitsCache.set(code, digits)
  return digits
}

const expandExponent = (value) => {
  let text = String(value).trim()
  if (text.includes(',')) {
    const validGrouping = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(text)
    if (!validGrouping) return null
    text = text.replaceAll(',', '')
  }
  if (/^[+-]?\./.test(text)) text = text.replace(/^([+-]?)\./, (_, sign = '') => `${sign}0.`)
  const match = text.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match) return null
  const [, sign, integer, fraction = '', exponentText = '0'] = match
  const exponent = Number(exponentText)
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1000) return null
  const digits = `${integer}${fraction}`
  const point = integer.length + exponent
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
}

/** Parse decimal currency input directly to minor units using decimal-string arithmetic. */
export const parseMinorUnits = (value, currency = 'INR') => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const normalized = expandExponent(value)
  if (!normalized) return null
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d*))?$/)
  if (!match) return null
  const [, sign, integer, fraction = ''] = match
  const precision = getCurrencyFractionDigits(currency)
  const coefficient = BigInt(`${integer}${fraction}` || '0')
  const shift = precision - fraction.length
  let minor
  if (shift >= 0) {
    minor = coefficient * (10n ** BigInt(shift))
  } else {
    const divisor = 10n ** BigInt(-shift)
    const quotient = coefficient / divisor
    const remainder = coefficient % divisor
    minor = quotient + (remainder * 2n >= divisor ? 1n : 0n)
  }
  if (sign === '-') minor *= -1n
  const numeric = Number(minor)
  return Number.isSafeInteger(numeric) ? numeric : null
}

export const toMinorUnits = (value, currency = 'INR') => parseMinorUnits(value, currency) ?? 0

export const fromMinorUnits = (minorUnits, currency = 'INR') => {
  const parsed = Number(minorUnits)
  if (!Number.isSafeInteger(parsed)) return 0
  const precision = getCurrencyFractionDigits(currency)
  return parsed / (10 ** precision)
}

export const formatCurrency = (amount, currency = 'INR') => {
  const code = String(currency || 'INR').toUpperCase()
  const precision = getCurrencyFractionDigits(code)
  const safeAmount = fromMinorUnits(toMinorUnits(amount, code), code)
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(safeAmount)
  } catch {
    return `${code} ${safeAmount.toFixed(precision)}`
  }
}

export const sumMinorUnits = (values, currency = 'INR') =>
  values.reduce((total, value) => total + toMinorUnits(value, currency), 0)
