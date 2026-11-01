import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'
import { Download, FileImage, FileText, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import {
  deleteSupabaseReceipt,
  getSupabaseReceiptList,
  getSupabaseReceiptUrls,
  invalidateSupabaseReceiptUrls,
  MAX_RECEIPT_BYTES,
} from '../../services/receiptUploads'
import { receiptUploadQueue } from '../../services/receiptUploadQueue'
import { getReceiptMimeType } from '../../lib/receiptFile'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const ReceiptRow = ({ receipt, urls, onOpen, onRefresh, onDelete, deleting }) => {
  const isImage = String(receipt.mimeType || '').startsWith('image/')
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-2.5">
      <button aria-label={`Open ${receipt.fileName || 'receipt'}`} className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand text-dusk" onClick={() => onOpen(receipt)} type="button">
        {isImage && urls?.thumbnail
          ? <img alt="Receipt thumbnail" className="h-full w-full object-cover" loading="lazy" onError={() => onRefresh(receipt)} src={urls.thumbnail} />
          : isImage ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(receipt)} type="button">
        <span className="block truncate text-sm font-semibold text-ink">{receipt.fileName || 'Receipt image'}</span>
        <span className="mt-0.5 block text-xs text-dusk">{receipt.size ? `${(receipt.size / 1024 / 1024).toFixed(1)} MB · private` : 'Private receipt'}</span>
      </button>
      {urls?.download ? <a aria-label="Download original receipt" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-dusk hover:bg-sand" href={urls.download} rel="noreferrer" target="_blank"><Download className="h-4 w-4" /></a> : null}
      {onDelete ? <button aria-label="Delete receipt" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-50" disabled={deleting} onClick={() => onDelete(receipt)} type="button">{deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button> : null}
    </div>
  )
}

const UploadJobRow = ({ job, onRetry }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-2.5" aria-live="polite">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand text-dusk">
      {job.previewUrl ? <img alt="Selected receipt preview" className="h-full w-full object-cover" src={job.previewUrl} /> : <FileImage className="h-5 w-5" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-ink">{job.file.name || 'Receipt image'}</p>
      {job.status === 'failed' ? <p className="mt-1 break-words text-xs text-red-600">{job.error}</p> : <p className="mt-1 text-xs text-dusk">{job.status === 'complete' ? 'Saved privately' : job.status === 'waiting' ? 'Waiting for connection…' : job.status === 'preparing' ? 'Preparing preview…' : `Uploading · ${job.progress}%`}</p>}
      {!['failed', 'complete', 'waiting'].includes(job.status) ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-teal transition-all" style={{ width: `${job.progress}%` }} /></div> : null}
    </div>
    {job.status === 'failed' || job.status === 'waiting' ? <Button onClick={() => onRetry(job.id)} size="sm" type="button" variant="secondary"><RefreshCw className="h-4 w-4" /> {job.status === 'failed' ? 'Retry' : 'Try now'}</Button> : null}
    {job.status === 'uploading' ? <LoaderCircle aria-label="Uploading" className="h-5 w-5 shrink-0 animate-spin text-teal" /> : null}
  </div>
)

export const ReceiptAttachments = ({ trip, expense, currentUser, canManage = false }) => {
  const receiptFiles = expense?.receiptFiles
  const receipts = useMemo(() => getSupabaseReceiptList({ receiptFiles }), [receiptFiles])
  const queueSnapshot = useSyncExternalStore(receiptUploadQueue.subscribe, receiptUploadQueue.getSnapshot, receiptUploadQueue.getSnapshot)
  const pendingJobs = queueSnapshot.filter((job) => job.tripId === trip?.id && job.expenseId === expense?.id && !receipts.some((receipt) => receipt.fileId === job.fileId))
  const receiptIdsKey = receipts.map((receipt) => receipt.fileId).sort().join('|')
  const [deletingFileId, setDeletingFileId] = useState('')
  const [urlsById, setUrlsById] = useState({})
  const [selected, setSelected] = useState(null)
  const [selectedUrls, setSelectedUrls] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const previewRefreshAttempted = useRef(false)
  const thumbnailRefreshAttempted = useRef(new Set())
  const isAuthorizedAccount = currentUser?.email?.trim().toLowerCase() === 'tsmane8787@gmail.com'
    && currentUser?.emailVerified === true && trip?.createdBy === currentUser?.uid
  const isCurrentMember = Boolean(currentUser?.uid && (trip?.createdBy === currentUser.uid || trip?.memberIds?.includes?.(currentUser.uid)))
  const canUploadReceipts = Boolean(!currentUser?.isAnonymous && isCurrentMember && (isAuthorizedAccount || trip?.allowMemberReceiptUploads === true))

  useEffect(() => {
    let active = true
    if (!receipts.length || !trip?.id || !expense?.id) return undefined
    Promise.all(receipts.filter((receipt) => !urlsById[receipt.fileId]).map(async (receipt) => {
      try { return [receipt.fileId, await getSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId, purpose: 'thumbnail' })] }
      catch (error) { return [receipt.fileId, { error: error.message || 'Could not load private preview.' }] }
    })).then((entries) => { if (active && entries.length) setUrlsById((value) => ({ ...value, ...Object.fromEntries(entries) })) })
    return () => { active = false }
    // Signed URL validity and in-flight de-duplication are managed by the service cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense?.id, receiptIdsKey, trip?.id])

  useEffect(() => {
    for (const job of queueSnapshot) {
      if (job.status === 'complete' && receipts.some((receipt) => receipt.fileId === job.fileId)) receiptUploadQueue.remove(job.id)
    }
  }, [queueSnapshot, receiptIdsKey, receipts])

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (!canUploadReceipts) { toast.error('You are not currently authorized to upload receipts for this trip.'); return }
    const valid = []
    for (const file of files) {
      if (!getReceiptMimeType(file)) toast.error(`${file.name}: choose a JPEG, PNG or WebP image.`)
      else if (file.size > MAX_RECEIPT_BYTES) toast.error(`${file.name}: receipt images must be 5 MB or smaller.`)
      else if (!file.size) toast.error(`${file.name}: choose an image with content.`)
      else valid.push(file)
    }
    valid.forEach((file) => receiptUploadQueue.enqueue({ tripId: trip.id, expenseId: expense.id, file }))
  }

  const openReceipt = async (receipt, forceRefresh = false) => {
    if (!trip?.id || !expense?.id) return
    if (forceRefresh) invalidateSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId })
    previewRefreshAttempted.current = false
    setSelected(receipt)
    setSelectedUrls(null)
    setPreviewLoading(true)
    try {
      const urls = await getSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId, forceRefresh })
      setSelectedUrls(urls)
      setUrlsById((current) => ({ ...current, [receipt.fileId]: urls }))
    } catch (error) {
      toast.error(error.message || 'Could not open this private receipt.')
      setSelected(null)
    } finally { setPreviewLoading(false) }
  }

  const refreshRowUrl = async (receipt) => {
    if (thumbnailRefreshAttempted.current.has(receipt.fileId)) {
      setUrlsById((current) => ({ ...current, [receipt.fileId]: { error: 'The private thumbnail is unavailable.' } }))
      return
    }
    thumbnailRefreshAttempted.current.add(receipt.fileId)
    invalidateSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId })
    try {
      const refreshed = await getSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId, purpose: 'thumbnail', forceRefresh: true })
      setUrlsById((current) => ({ ...current, [receipt.fileId]: refreshed }))
    } catch (error) { setUrlsById((current) => ({ ...current, [receipt.fileId]: { error: error.message || 'Could not refresh preview.' } })) }
  }

  const removeReceipt = async (receipt) => {
    if (!canManage || deletingFileId) return
    if (!window.confirm('Delete this receipt image? This does not change the expense.')) return
    setDeletingFileId(receipt.fileId)
    try {
      await deleteSupabaseReceipt({ tripId: trip.id, expenseId: expense.id, receipt })
      setUrlsById((current) => { const next = { ...current }; delete next[receipt.fileId]; return next })
      invalidateSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId })
      if (selected?.fileId === receipt.fileId) setSelected(null)
      toast.success('Receipt deleted.')
    } catch (error) { toast.error(error.message || 'Could not delete this receipt.') }
    finally { setDeletingFileId('') }
  }

  const handlePreviewError = async () => {
    if (!selected || !trip?.id || !expense?.id) return
    if (previewRefreshAttempted.current) {
      toast.error('The private image could not be loaded after refreshing its link. Check your connection or contact the trip admin.')
      return
    }
    previewRefreshAttempted.current = true
    invalidateSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: selected.fileId })
    try {
      const refreshed = await getSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: selected.fileId, forceRefresh: true })
      setSelectedUrls(refreshed)
      setUrlsById((current) => ({ ...current, [selected.fileId]: refreshed }))
    } catch (error) { toast.error(error.message || 'The private receipt link expired. Reopen the receipt to retry.') }
  }

  return (
    <section className="min-w-0 space-y-3" aria-label="Private receipt images">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-ink">Receipt images</h3><p className="mt-0.5 text-xs text-dusk">Private to current trip members. Originals are preserved. Maximum 5 MB each.</p></div>
        {canUploadReceipts ? <div className="flex shrink-0 gap-2">
          <input ref={cameraRef} accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFiles} type="file" />
          <input ref={galleryRef} accept="image/jpeg,image/png,image/webp" className="hidden" multiple onChange={handleFiles} type="file" />
          <Button onClick={() => cameraRef.current?.click()} size="sm" type="button" variant="secondary"><ImagePlus className="h-4 w-4" /> Camera</Button>
          <Button onClick={() => galleryRef.current?.click()} size="sm" type="button" variant="secondary"><ImagePlus className="h-4 w-4" /> Add images</Button>
        </div> : null}
      </div>

      {!canUploadReceipts ? <p className="rounded-xl bg-sand px-3 py-2 text-xs leading-5 text-dusk">{currentUser?.isAnonymous ? 'Guest accounts cannot upload receipts. Current trip members can view attached receipts.' : !isCurrentMember ? 'Only current trip members can upload or view private receipts.' : trip?.allowMemberReceiptUploads === true ? 'Receipt uploads are enabled for trip members. Guest accounts are excluded.' : 'Member uploads are disabled. Only the verified trip creator can upload receipts.'}</p> : null}
      {pendingJobs.length ? <div className="grid min-w-0 gap-2 sm:grid-cols-2">{pendingJobs.map((job) => <UploadJobRow key={job.id} job={job} onRetry={receiptUploadQueue.retry} />)}</div> : null}
      {receipts.length ? <div className="grid min-w-0 gap-2 sm:grid-cols-2">{receipts.map((receipt) => <ReceiptRow key={receipt.fileId} deleting={deletingFileId === receipt.fileId} onDelete={canManage ? removeReceipt : null} onOpen={openReceipt} onRefresh={refreshRowUrl} receipt={receipt} urls={urlsById[receipt.fileId]} />)}</div> : !pendingJobs.length ? <p className="rounded-xl bg-sand/70 px-3 py-3 text-sm text-dusk">No private receipt images attached.</p> : null}

      <Modal description={selected?.fileName || 'Private receipt'} fullScreen onClose={() => setSelected(null)} open={Boolean(selected)} title="Receipt preview">
        {previewLoading ? <div className="flex min-h-48 items-center justify-center text-dusk"><LoaderCircle className="h-5 w-5 animate-spin" /><span className="ml-2">Loading securely…</span></div> : null}
        {selectedUrls ? <div className="space-y-3">
          {String(selected?.mimeType || '').startsWith('image/') ? <img alt="Expense receipt" className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain" onError={handlePreviewError} src={selectedUrls.preview || selectedUrls.original} /> : <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl bg-sand text-dusk"><FileText className="h-10 w-10" /><span>Preview not available for this file type.</span></div>}
          <a className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white" href={selectedUrls.download} rel="noreferrer" target="_blank"><Download className="h-4 w-4" /> Download original</a>
        </div> : null}
      </Modal>
    </section>
  )
}
