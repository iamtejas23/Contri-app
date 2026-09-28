import { AlertTriangle } from 'lucide-react'

import { Button } from './Button'

export const ErrorState = ({
  title = 'Something went wrong',
  description = 'We could not load this. Check your connection and try again.',
  onRetry,
}) => (
  <div className="flex flex-col items-center rounded-2xl border border-red-200 bg-white px-6 py-14 text-center shadow-card">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
      <AlertTriangle className="h-7 w-7" />
    </div>
    <p className="font-display text-xl font-semibold text-ink">{title}</p>
    <p className="mx-auto mt-2 max-w-sm text-sm text-dusk">{description}</p>
    {onRetry ? (
      <Button className="mt-6" onClick={onRetry} type="button">
        Try again
      </Button>
    ) : null}
  </div>
)
