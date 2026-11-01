import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, FileImage, FileText, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import {
  attachReceiptMetadata,
  deleteSupabaseReceipt,
  getSupabaseReceiptList,
  getSupabaseReceiptUrls,
  MAX_RECEIPT_BYTES,
  uploadSupabaseReceipt,
} from '../../services/receiptUploads'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const ReceiptRow = ({ receipt, urls, onOpen, onDelete, deleting }) => {
  const isImage = String(receipt.mimeType || '').startsWith('image/')
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-2.5">
      <button
        aria-label={`Open ${receipt.fileName || 'receipt'}`}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand text-dusk"
        onClick={() => onOpen(receipt)}
        type="button"
      >
        {isImage && urls?.thumbnail
          ? <img alt="Receipt thumbnail" className="h-full w-full object-cover" loading="lazy" src={urls.thumbnail} />
          : isImage ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(receipt)} type="button">
        <span className="block truncate text-sm font-semibold text-ink">{receipt.fileName || 'Receipt image'}</span>
        <span className="mt-0.5 block text-xs text-dusk">{receipt.size ? `${(receipt.size / 1024 / 1024).toFixed(1)} MB` : 'Private receipt'}</span>
      </button>
      {urls?.download ? (
        <a aria-label="Download original receipt" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-dusk hover:bg-sand" href={urls.download} rel="noreferrer" target="_blank">
          <Download className="h-4 w-4" />
        </a>
      ) : null}
      {onDelete ? (
        <button aria-label="Delete receipt" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-50" disabled={deleting} onClick={() => onDelete(receipt)} type="button">
          {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  )
}

export const ReceiptAttachments = ({ trip, expense, currentUser, canManage = false }) => {
  const receipts = useMemo(() => getSupabaseReceiptList(expense), [expense])
  const [progress, setProgress] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState('')
  const [urlsById, setUrlsById] = useState({})
  const [selected, setSelected] = useState(null)
  const [selectedUrls, setSelectedUrls] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [retryReceipt, setRetryReceipt] = useState(null)
  const [retryUploadFile, setRetryUploadFile] = useState(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const uploadLock = useRef(false)
  const isAuthorizedAccount = currentUser?.email?.toLowerCase() === 'tsmane8787@gmail.com'
    && currentUser?.emailVerified === true
    && trip?.createdBy === currentUser?.uid
  const receiptIdsKey = receipts.map((receipt) => receipt.fileId).join('|')

  useEffect(() => {
    let active = true
    const pending = receipts.filter((receipt) => !urlsById[receipt.fileId])
    if (!pending.length || !trip?.id || !expense?.id) return undefined
    Promise.all(pending.map(async (receipt) => {
      try {
        const urls = await getSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId })
        return [receipt.fileId, urls]
      } catch {
        return [receipt.fileId, { error: true }]
      }
    })).then((entries) => {
      if (active) setUrlsById((current) => ({ ...current, ...Object.fromEntries(entries) }))
    })
    return () => { active = false }
    // Cache is keyed by the expense and receipts; signed URLs are short lived, and refreshed when the detail opens again.
  }, [expense?.id, receiptIdsKey, trip?.id, urlsById, receipts])

  const attachUploaded = async (receipt) => {
    await attachReceiptMetadata({ tripId: trip.id, expenseId: expense.id, receipt })
    setRetryReceipt(null)
    toast.success('Private receipt attached.')
  }

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || uploadLock.current) return
    if (!isAuthorizedAccount) {
      toast.error('Only the verified trip creator account can upload receipts.')
      return
    }
    const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_RECEIPT_BYTES)
    if (invalid) {
      toast.error(invalid.size > MAX_RECEIPT_BYTES ? 'Receipt images must be 50 MB or smaller.' : 'Choose a JPEG, PNG or WebP image.')
      return
    }

    uploadLock.current = true
    setUploading(true)
    setRetryUploadFile(null)
    let fileInProgress = null
    try {
      for (const file of files) {
        fileInProgress = file
        setProgress({ name: file.name, value: 0 })
        const receipt = await uploadSupabaseReceipt({
          tripId: trip.id,
          expenseId: expense.id,
          file,
          onProgress: (value) => setProgress({ name: file.name, value }),
        })
        fileInProgress = null
        try {
          await attachUploaded(receipt)
        } catch (error) {
          setRetryReceipt(receipt)
          toast.error(`Image uploaded, but could not attach it: ${error.message}`)
          break
        }
      }
    } catch (error) {
      if (fileInProgress) setRetryUploadFile(fileInProgress)
      toast.error(error.message || 'Could not upload that receipt.')
    } finally {
      uploadLock.current = false
      setUploading(false)
      setProgress(null)
    }
  }

  const openReceipt = async (receipt) => {
    setSelected(receipt)
    setSelectedUrls(null)
    setPreviewLoading(true)
    try {
      const urls = await getSupabaseReceiptUrls({ tripId: trip.id, expenseId: expense.id, fileId: receipt.fileId })
      setSelectedUrls(urls)
      setUrlsById((current) => ({ ...current, [receipt.fileId]: urls }))
    } catch (error) {
      toast.error(error.message || 'Could not open this private receipt.')
      setSelected(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const removeReceipt = async (receipt) => {
    if (!canManage || deletingFileId) return
    if (!window.confirm('Delete this receipt image? This does not change the expense.')) return
    setDeletingFileId(receipt.fileId)
    try {
      await deleteSupabaseReceipt({ tripId: trip.id, expenseId: expense.id, receipt })
      setUrlsById((current) => {
        const next = { ...current }
        delete next[receipt.fileId]
        return next
      })
      if (selected?.fileId === receipt.fileId) setSelected(null)
      toast.success('Receipt deleted.')
    } catch (error) {
      toast.error(error.message || 'Could not delete this receipt.')
    } finally {
      setDeletingFileId('')
    }
  }

  const retryAttach = async () => {
    if (!retryReceipt) return
    try {
      await attachUploaded(retryReceipt)
    } catch (error) {
      toast.error(error.message || 'Could not attach the uploaded receipt.')
    }
  }

  const retryUpload = async () => {
    if (!retryUploadFile || uploadLock.current) return
    uploadLock.current = true
    setUploading(true)
    setProgress({ name: retryUploadFile.name, value: 0 })
    try {
      const receipt = await uploadSupabaseReceipt({
        tripId: trip.id,
        expenseId: expense.id,
        file: retryUploadFile,
        onProgress: (value) => setProgress({ name: retryUploadFile.name, value }),
      })
      setRetryUploadFile(null)
      try {
        await attachUploaded(receipt)
      } catch (error) {
        setRetryReceipt(receipt)
        toast.error(`Image uploaded, but could not attach it: ${error.message}`)
      }
    } catch (error) {
      toast.error(error.message || 'Could not upload that receipt.')
    } finally {
      uploadLock.current = false
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <section className="min-w-0 space-y-3" aria-label="Private receipt images">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Receipt images</h3>
          <p className="mt-0.5 text-xs text-dusk">Private to current trip members. Original images are preserved. Maximum 50 MB each.</p>
        </div>
        {isAuthorizedAccount ? (
          <div className="flex shrink-0 gap-2">
            <input ref={cameraRef} accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFiles} type="file" />
            <input ref={galleryRef} accept="image/jpeg,image/png,image/webp" className="hidden" multiple onChange={handleFiles} type="file" />
            <Button disabled={uploading} onClick={() => cameraRef.current?.click()} size="sm" type="button" variant="secondary">
              <ImagePlus className="h-4 w-4" /> Camera
            </Button>
            <Button disabled={uploading} onClick={() => galleryRef.current?.click()} size="sm" type="button" variant="secondary">
              <ImagePlus className="h-4 w-4" /> Add images
            </Button>
          </div>
        ) : null}
      </div>

      {!isAuthorizedAccount ? (
        <p className="rounded-xl bg-sand px-3 py-2 text-xs leading-5 text-dusk">Uploads are available only on trips created by the verified authorized account. Current trip members can view attached receipts.</p>
      ) : null}
      {uploading ? (
        <div className="rounded-xl bg-sand p-3" aria-live="polite">
          <div className="flex justify-between gap-3 text-xs text-dusk"><span className="min-w-0 truncate">Uploading {progress?.name || 'receipt'}…</span><span>{progress?.value || 0}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-teal transition-all" style={{ width: `${progress?.value || 0}%` }} /></div>
        </div>
      ) : null}
      {retryReceipt ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-dusk">
          <span>Upload completed, but its expense link still needs saving.</span>
          <Button onClick={retryAttach} size="sm" type="button" variant="secondary">Retry attach</Button>
        </div>
      ) : null}
      {retryUploadFile ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-dusk">
          <span className="min-w-0 break-all">{retryUploadFile.name} did not finish uploading.</span>
          <Button disabled={uploading} onClick={retryUpload} size="sm" type="button" variant="secondary">Retry upload</Button>
        </div>
      ) : null}
      {receipts.length ? (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {receipts.map((receipt) => (
            <ReceiptRow key={receipt.fileId} deleting={deletingFileId === receipt.fileId} onDelete={canManage ? removeReceipt : null} onOpen={openReceipt} receipt={receipt} urls={urlsById[receipt.fileId]} />
          ))}
        </div>
      ) : <p className="rounded-xl bg-sand/70 px-3 py-3 text-sm text-dusk">No private receipt images attached.</p>}

      <Modal description={selected?.fileName || 'Private receipt'} fullScreen onClose={() => setSelected(null)} open={Boolean(selected)} title="Receipt preview">
        {previewLoading ? <div className="flex min-h-48 items-center justify-center text-dusk"><LoaderCircle className="h-5 w-5 animate-spin" /> <span className="ml-2">Loading securely…</span></div> : null}
        {selectedUrls ? (
          <div className="space-y-3">
            {String(selected?.mimeType || '').startsWith('image/')
              ? <img alt="Expense receipt" className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain" src={selectedUrls.preview || selectedUrls.original} />
              : <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl bg-sand text-dusk"><FileText className="h-10 w-10" /><span>Preview not available for this file type.</span></div>}
            <a className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white" href={selectedUrls.download} rel="noreferrer" target="_blank">
              <Download className="h-4 w-4" /> Download original
            </a>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
