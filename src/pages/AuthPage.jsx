import { CheckCircle2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

import { useAuth } from '../context/useAuth'
import { Button } from '../components/ui/Button'
import { BrandMark } from '../components/BrandMark'

const GoogleIcon = () => (
  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const features = [
  'Log petrol, toll, food, and hotel in a few taps',
  'See exactly who owes whom, then pay with UPI',
  'Share the hisab on WhatsApp before the group chat starts',
]

export const AuthPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'
  const { loginWithGoogle, loginWithNativeGoogle } = useAuth()
  const isNativeAndroid = Capacitor.getPlatform() === 'android'
  const [loading, setLoading] = useState(false)

  const handleGoogle = async () => {
    setLoading(true)
    try {
      if (isNativeAndroid) {
        await loginWithNativeGoogle()
        navigate(redirectTo, { replace: true })
      } else {
        await loginWithGoogle()
        navigate(redirectTo, { replace: true })
      }
    } catch {
      /* service layer shows toast */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-sand">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row">

        {/* Left panel — brand */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-[#080808] px-6 py-7 sm:p-8 lg:min-h-dvh lg:w-[45%] lg:p-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <div>
              <span className="font-display text-lg font-bold lowercase leading-none text-white">contri</span>
              <span className="mt-1 block text-[10px] text-zinc-400">Travel together. Split together.</span>
            </div>
          </div>

          {/* Hero text */}
          <div className="py-10 lg:py-0">
            <h1 className="font-display text-4xl font-bold leading-tight text-white lg:text-5xl">
              Trip khatam.<br />Hisab bhi khatam.
            </h1>
            <p className="mt-4 text-base text-zinc-400">
              The fastest way for Indian friends to split a trip. Rupees first,
              UPI to settle, WhatsApp when someone needs a nudge.
            </p>
            <div className="mt-8 space-y-3">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                  <p className="text-sm text-zinc-300">{f}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer quote */}
          <p className="text-xs text-zinc-500">
            Road trips, long weekends, and the group chat that should not do the math.
          </p>

          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/5 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-emerald-500/5 blur-2xl" />
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-sm">
            <h2 className="font-display text-2xl font-bold text-ink">
              Welcome to Contri
            </h2>
            <p className="mt-1.5 text-sm text-dusk">
              Sign in with Google to continue or create your account.
            </p>

            {/* Google button */}
            <Button
              className="mt-6 w-full"
              loading={loading}
              onClick={handleGoogle}
              size="lg"
              type="button"
              variant="secondary"
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <Button
              className="mt-3 w-full"
              onClick={() => navigate(redirectTo.startsWith('/join') ? redirectTo : '/join')}
              size="lg"
              type="button"
              variant="secondary"
            >
              <UserRound className="h-4 w-4" />
              Join as Guest
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-dusk/70">
              Guest accounts are anonymous. Sign out or losing this device can make your trip data hard to recover. Link Google from your profile to keep the same account.
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}
