const MONEY =
  /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi

const TOTAL_HINT =
  /(grand\s*total|amount\s*payable|net\s*amount|total|to\s*pay|bill\s*amount|balance)/i

const parseMoney = (raw: string) => {
  const cleaned = String(raw).replace(/,/g, '')
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 10000000) return null
  return Number(value.toFixed(2))
}

const amountsIn = (line: string) => {
  const found: number[] = []
  const pattern = new RegExp(MONEY.source, 'gi')
  let match = pattern.exec(line)

  while (match) {
    const value = parseMoney(match[1])
    if (value) found.push(value)
    match = pattern.exec(line)
  }

  return found
}

export const parseReceiptText = (text = '') => {
  const lines = String(text)
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1)

  const hinted: number[] = []
  const all: number[] = []

  lines.forEach((line) => {
    const amounts = amountsIn(line)
    all.push(...amounts)
    if (TOTAL_HINT.test(line)) hinted.push(...amounts)
  })

  const pool = hinted.length ? hinted : all
  const amount = pool.length ? Math.max(...pool) : null

  const title =
    lines.find((line) => {
      const letters = line.replace(/[^a-zA-Z]/g, '')
      return letters.length >= 3 && !TOTAL_HINT.test(line) && !/^\d/.test(line)
    }) || ''

  return {
    amount: amount ? String(amount) : '',
    title: title.slice(0, 48),
    raw: text,
  }
}
