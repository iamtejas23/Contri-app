export const createReceiptUrlCache = ({ now = () => Date.now(), safetyWindowMs = 5_000 } = {}) => {
  const values = new Map()
  const inflight = new Map()
  return {
    async get(key, loader, { forceRefresh = false } = {}) {
      const cached = values.get(key)
      if (!forceRefresh && cached && cached.expiresAt > now() + safetyWindowMs) return cached.value
      if (!forceRefresh && inflight.has(key)) return inflight.get(key)
      const promise = Promise.resolve().then(loader).then((value) => {
        const seconds = Math.max(15, Number(value?.expiresIn) || 120)
        values.set(key, { value, expiresAt: now() + Math.max(10, seconds - 10) * 1000 })
        return value
      }).finally(() => inflight.delete(key))
      inflight.set(key, promise)
      return promise
    },
    invalidate(key) { values.delete(key); inflight.delete(key) },
    clear() { values.clear(); inflight.clear() },
  }
}
