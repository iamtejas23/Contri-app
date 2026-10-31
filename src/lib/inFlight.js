const pendingOperations = new Map()

/** Coalesces identical simultaneous submits while allowing a later intentional repeat. */
export const runInFlightOnce = (key, operation) => {
  if (pendingOperations.has(key)) return pendingOperations.get(key)
  const pending = Promise.resolve().then(operation)
  pendingOperations.set(key, pending)
  return pending.finally(() => {
    if (pendingOperations.get(key) === pending) pendingOperations.delete(key)
  })
}

export const serializeOperation = (value) => JSON.stringify(value, (_key, item) => {
  if (typeof item === 'number' && !Number.isFinite(item)) return String(item)
  return item
})
