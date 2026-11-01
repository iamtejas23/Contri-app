const MAX_EDGE = 480
const MAX_BYTES = 256 * 1024

export const getReceiptThumbnailDimensions = (width, height, maxEdge = MAX_EDGE) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const ratio = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

const loadImage = async (file) => {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)
  if (typeof Image === 'undefined') throw new Error('This device cannot prepare a receipt preview.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare a receipt thumbnail.')), 'image/jpeg', quality)
})

/** Produces a private, small display derivative. The original File is never changed. */
export const createReceiptThumbnail = async (file) => {
  if (typeof document === 'undefined') return null
  let image
  try {
    image = await loadImage(file)
    const dimensions = getReceiptThumbnailDimensions(image.width, image.height)
    if (!dimensions) return null
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return null
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
    for (const quality of [0.78, 0.68, 0.58]) {
      const blob = await toBlob(canvas, quality)
      if (blob.size <= MAX_BYTES) return blob
    }
    return null
  } catch {
    // Original upload remains available if a WebView cannot create a thumbnail.
    return null
  } finally {
    image?.close?.()
  }
}
