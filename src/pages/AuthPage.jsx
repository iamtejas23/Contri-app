import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const GoogleIcon = () => (
  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const features = [
  'Real-time expense tracking across the whole group',
  'Flexible splits: equal, exact, shares, or percentages',
  'Smart settlement suggestions + PDF & CSV export',
]

export const AuthPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isRegister = location.pathname === '/register'
  const redirectTo = location.state?.from || '/'
  const { login, register, loginWithGoogle } = useAuth()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((c) => ({ ...c, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isRegister) await register(form)
      else await login(form)
      navigate(redirectTo, { replace: true })
    } catch {
      /* service layer shows toast */
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    try {
      await loginWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch {
      /* service layer shows toast */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">

        {/* Left panel — brand */}
        <div className="relative flex flex-col justify-between bg-teal p-8 lg:w-[45%] lg:p-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white">C</div>
            <span className="font-display text-lg font-semibold text-white">Contri-app</span>
          </div>

          {/* Hero text */}
          <div className="py-12 lg:py-0">
            <h1 className="font-display text-4xl font-bold leading-tight text-white lg:text-5xl">
              Split trips,<br />not friendships.
            </h1>
            <p className="mt-4 text-base text-white/70">
              Log bills in real time, see exactly who owes what, and settle
              up without the awkward group-chat math.
            </p>
            <div className="mt-8 space-y-3">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-white/70" />
                  <p className="text-sm text-white/80">{f}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer quote */}
          <p className="text-xs text-white/40">
            Trusted for weekend getaways, road trips &amp; destination weddings.
          </p>

          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/5" />
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-sm">
            <h2 className="font-display text-2xl font-bold text-ink">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-1.5 text-sm text-dusk">
              {isRegister
                ? 'Start tracking shared expenses in minutes.'
                : 'Sign in to continue where you left off.'}
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

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">or with email</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Email form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {isRegister ? (
                <Input
                  label="Full name"
                  name="name"
                  onChange={handleChange}
                  placeholder="Tejas Mane"
                  required
                  value={form.name}
                />
              ) : null}
              <Input
                autoComplete="email"
                label="Email address"
                name="email"
                onChange={handleChange}
                placeholder="you@example.com"
                required
                type="email"
                value={form.email}
              />
              <Input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                label="Password"
                minLength={6}
                name="password"
                onChange={handleChange}
                placeholder="Min. 6 characters"
                required
                type="password"
                value={form.password}
              />

              <Button className="w-full" loading={loading} size="lg" type="submit">
                {isRegister ? 'Create account' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-dusk">
              {isRegister ? 'Already have an account? ' : 'Need an account? '}
              <Link
                className="font-semibold text-teal hover:underline"
                to={isRegister ? '/login' : '/register'}
              >
                {isRegister ? 'Sign in' : 'Sign up free'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
