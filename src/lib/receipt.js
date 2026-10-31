import { fromMinorUnits, getCurrencyFractionDigits, parseMinorUnits, toMinorUnits } from './money.js'

const MONEY = /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.\d+)?|[0-9]+(?:\.\d+)?)/gi

const TOTAL_HINT = /(grand\s*total|amount\s*payable|net\s*amount|total|to\s*pay|bill\s*amount|balance)/i

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'

const parseMoney = (raw, currency = 'INR') => {
  const cleaned = String(raw).replace(/,/g, '')
  const minor = parseMinorUnits(cleaned, currency)
  if (!minor || minor < 0 || minor > toMinorUnits(10000000, currency)) {
    return null
  }
  return Number(fromMinorUnits(minor, currency).toFixed(getCurrencyFractionDigits(currency)))
}

const amountsIn = (line, currency) => {
  const found = []
  const pattern = new RegExp(MONEY.source, 'gi')
  let match = pattern.exec(line)

  while (match) {
    const value = parseMoney(match[1], currency)
    if (value) {
      found.push(value)
    }
    match = pattern.exec(line)
  }

  return found
}

export const parseReceiptText = (text = '', currency = 'INR') => {
  const lines = String(text)
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1)

  const hinted = []
  const all = []

  lines.forEach((line) => {
    const amounts = amountsIn(line, currency)
    all.push(...amounts)
    if (TOTAL_HINT.test(line)) {
      hinted.push(...amounts)
    }
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

const loadTesseract = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Receipt scanning only works in the browser.'))
  }

  if (window.Tesseract?.createWorker) {
    return Promise.resolve(window.Tesseract)
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-contri-tesseract]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Tesseract), { once: true })
      existing.addEventListener('error', () => reject(new Error('Could not load the receipt scanner.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = TESSERACT_CDN
    script.async = true
    script.dataset.contriTesseract = 'true'
    script.onload = () => {
      if (!window.Tesseract?.createWorker) {
        reject(new Error('Receipt scanner failed to start.'))
        return
      }
      resolve(window.Tesseract)
    }
    script.onerror = () => reject(new Error('Could not load the receipt scanner.'))
    document.head.appendChild(script)
  })
}

export const scanReceiptFile = async (file, onProgress, currency = 'INR') => {
  const Tesseract = await loadTesseract()
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.(Math.round(message.progress * 100))
      }
    },
  })

  try {
    const result = await worker.recognize(file)
    return parseReceiptText(result.data?.text || '', currency)
  } finally {
    await worker.terminate()
  }
}
