const secureId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  throw new Error('Secure receipt upload IDs are unavailable in this browser.')
}

export const createReceiptUploadQueue = ({ run, maxConcurrent = 2, isOnline = () => globalThis.navigator?.onLine !== false, createPreviewUrl = (file) => URL.createObjectURL(file), revokePreviewUrl = (url) => URL.revokeObjectURL(url) }) => {
  const jobs = new Map()
  const listeners = new Set()
  let active = 0
  let serial = 0
  let currentSnapshot = []
  const snapshot = () => currentSnapshot
  const emit = () => { currentSnapshot = [...jobs.values()].sort((a, b) => a.order - b.order); listeners.forEach((listener) => listener()) }
  const pump = () => {
    if (!isOnline()) {
      for (const job of jobs.values()) if (job.status === 'queued') job.status = 'waiting'
      emit()
      return
    }
    for (const job of jobs.values()) {
      if (active >= maxConcurrent) break
      if (!['queued', 'waiting'].includes(job.status)) continue
      job.status = 'uploading'
      active += 1
      emit()
      Promise.resolve(run(job, (progress) => {
        job.progress = Math.max(job.progress, Math.min(99, Number(progress) || 0))
        emit()
      })).then((receipt) => {
        job.status = 'complete'
        job.progress = 100
        job.receipt = receipt
        job.error = ''
      }).catch((error) => {
        job.status = 'failed'
        job.error = error?.message || 'Upload failed. Retry when your connection is available.'
      }).finally(() => {
        active -= 1
        emit()
        pump()
      })
    }
  }
  const onlineHandler = () => {
    for (const job of jobs.values()) if (job.status === 'waiting' || (job.status === 'failed' && /network|connection|offline|timed out/i.test(job.error))) job.status = 'queued'
    pump()
  }
  globalThis.window?.addEventListener?.('online', onlineHandler)
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: snapshot,
    enqueue({ tripId, expenseId, file }) {
      const job = { id: secureId(), fileId: secureId(), tripId, expenseId, file, previewUrl: createPreviewUrl(file), status: isOnline() ? 'queued' : 'waiting', progress: 0, error: '', receipt: null, order: serial++ }
      jobs.set(job.id, job)
      emit()
      pump()
      return job.id
    },
    retry(id) {
      const job = jobs.get(id)
      if (!job || !['failed', 'waiting'].includes(job.status)) return
      job.status = isOnline() ? 'queued' : 'waiting'
      job.progress = 0
      job.error = ''
      emit()
      pump()
    },
    resume: onlineHandler,
    remove(id) {
      const job = jobs.get(id)
      if (!job || !['complete', 'failed', 'waiting'].includes(job.status)) return
      revokePreviewUrl(job.previewUrl)
      jobs.delete(id)
      emit()
    },
    dispose() { globalThis.window?.removeEventListener?.('online', onlineHandler); listeners.clear() },
  }
}
