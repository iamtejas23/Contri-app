import { useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-mesh px-4 py-8">
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">404</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink">
          That page took a detour
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-dusk/70">
          The route you tried does not exist in this trip board. Let’s get you back to
          something useful.
        </p>
        <Button className="mt-6" onClick={() => navigate('/')} type="button">
          Go to dashboard
        </Button>
      </Card>
    </div>
  )
}
