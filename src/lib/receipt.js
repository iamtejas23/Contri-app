const MONEY = /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi

const TOTAL_HINT = /(grand\s*total|amount\s*payable|net\s*amount|total|to\s*pay|bill\s*amount|balance)/i

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'

const parseMoney = (raw) => {
  const cleaned = String(raw).replace(/,/g, '')
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 10000000) {
    return null
  }
  return Number(value.toFixed(2))
}

const amountsIn = (line) => {
  const found = []
  const pattern = new RegExp(MONEY.source, 'gi')
  let match = pattern.exec(line)

  while (match) {
    const value = parseMoney(match[1])
    if (value) {
      found.push(value)
    }
    match = pattern.exec(line)
  }

  return found
}

export const parseReceiptText = (text = '') => {
  const lines = String(text)
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1)

  const hinted = []
  const all = []

  lines.forEach((line) => {
    const amounts = amountsIn(line)
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

export const scanReceiptFile = async (file, onProgress) => {
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
    return parseReceiptText(result.data?.text || '')
  } finally {
    await worker.terminate()
  }
}
