const activeLocks = new WeakMap()

/**
 * Acquire a shared body scroll lock for portals/overlays.
 * Nested dialogs must not restore `overflow` until the final overlay closes.
 */
export const acquireBodyScrollLock = (body = globalThis.document?.body) => {
  if (!body?.style) return () => {}

  let state = activeLocks.get(body)
  if (!state) {
    state = { count: 0, originalOverflow: body.style.overflow }
    activeLocks.set(body, state)
    body.style.overflow = 'hidden'
  }
  state.count += 1

  let released = false
  return () => {
    if (released) return
    released = true

    const current = activeLocks.get(body)
    if (!current) return
    current.count -= 1
    if (current.count === 0) {
      body.style.overflow = current.originalOverflow
      activeLocks.delete(body)
    }
  }
}
