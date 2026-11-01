import { attachReceiptMetadata, uploadSupabaseReceipt } from './receiptUploads'
import { createReceiptThumbnail } from '../lib/receiptThumbnail'
import { createReceiptUploadQueue } from '../lib/receiptUploadQueue'

const queue = createReceiptUploadQueue({
  run: async (job, onProgress) => {
    if (job.thumbnailBlob === undefined) job.thumbnailBlob = await createReceiptThumbnail(job.file)
    const receipt = await uploadSupabaseReceipt({ tripId: job.tripId, expenseId: job.expenseId, file: job.file, fileId: job.fileId, thumbnailBlob: job.thumbnailBlob, onProgress })
    await attachReceiptMetadata({ tripId: job.tripId, expenseId: job.expenseId, receipt })
    return receipt
  },
})

export const receiptUploadQueue = queue
