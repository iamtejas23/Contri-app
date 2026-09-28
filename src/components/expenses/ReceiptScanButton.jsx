import { Camera, LoaderCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { scanReceiptFile } from '../../lib/receipt'

export const ReceiptScanButton = ({ onResult, compact = false }) => {
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Choose a photo of the bill.')
      return
    }

    setError('')
    setProgress(0)

    try {
      const parsed = await scanReceiptFile(file, setProgress)

      if (!parsed.amount && !parsed.title) {
        setError('Could not read an amount. Type it in — the photo stays on this device.')
        toast.error('Could not read that receipt.')
        return
      }

      onResult(parsed)
      toast.success(parsed.amount ? `Found ${parsed.amount}` : 'Filled what we could read.')
    } catch {
      setError('Receipt scan failed. You can still type the amount.')
      toast.error('Receipt scan failed.')
    } finally {
      setProgress(null)
    }
  }

  const scanning = progress !== null

  return (
    <div>
      <input
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        ref={inputRef}
        type="file"
      />
      <button
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal/40 bg-teal/5 font-medium text-teal transition hover:bg-teal/10 disabled:opacity-60 ${
          compact ? 'h-10 px-3 text-sm' : 'h-11 w-full px-4 text-sm'
        }`}
        disabled={scanning}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {scanning ? `Reading receipt… ${progress}%` : 'Scan receipt'}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {!error && !scanning ? (
        <p className="mt-2 text-xs text-dusk">Photo is read on your phone. Nothing is uploaded.</p>
      ) : null}
    </div>
  )
}
