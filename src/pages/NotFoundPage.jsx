import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/Button'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Compass className="h-8 w-8" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-dusk">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Page not found</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-dusk">
          The route you tried does not exist. Let's get you back to your trip board.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Button onClick={() => navigate('/')} size="lg" type="button">
            Go to dashboard
          </Button>
          <Button onClick={() => navigate(-1)} type="button" variant="ghost">
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}
