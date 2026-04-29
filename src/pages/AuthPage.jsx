import { ArrowRight, Globe } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export const AuthPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isRegister = location.pathname === '/register'
  const redirectTo = location.state?.from || '/'
  const { login, register, loginWithGoogle } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      if (isRegister) {
        await register(form)
      } else {
        await login(form)
      }

      navigate(redirectTo, { replace: true })
    } catch {
      // Service layer already shows a toast for Firebase failures.
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
      // Service layer already shows a toast for Firebase failures.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mesh px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-gradient-to-br from-ink via-dusk to-teal p-8 text-white shadow-float">
          <div className="absolute -right-16 top-10 h-40 w-40 rounded-full bg-coral/35 blur-3xl" />
          <div className="absolute -left-12 bottom-6 h-36 w-36 rounded-full bg-mint/35 blur-3xl" />
          <p className="text-sm uppercase tracking-[0.22em] text-white/65">Contri-app</p>
          <h1 className="mt-5 max-w-xl font-display text-5xl font-bold leading-tight">
            Split trips, not friendships.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/75">
            Plan the trip, log bills in real time, simplify what everyone owes, and
            keep the group on the same page without a backend to babysit.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              'Real-time trip expense tracking',
              'Flexible splits by equal, exact, shares, or percentages',
              'Settlement suggestions plus PDF and CSV export',
            ].map((item) => (
              <div key={item} className="rounded-[1.75rem] bg-white/10 p-4 backdrop-blur">
                <p className="text-sm leading-6 text-white/85">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-white/70 bg-white/78 p-6 shadow-float backdrop-blur sm:p-8">
          <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold text-ink">
            {isRegister ? 'Start your first shared trip.' : 'Step back into the group ledger.'}
          </h2>
          <p className="mt-3 text-sm text-dusk/70">
            {isRegister
              ? 'Register with email or jump in with Google.'
              : 'Sign in to keep expenses, balances, and settlements moving.'}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {isRegister ? (
              <Input
                label="Name"
                name="name"
                onChange={handleChange}
                placeholder="Tejas"
                required
                value={form.name}
              />
            ) : null}
            <Input
              autoComplete="email"
              label="Email"
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
              placeholder="At least 6 characters"
              required
              type="password"
              value={form.password}
            />

            <Button className="w-full" loading={loading} size="lg" type="submit">
              {isRegister ? 'Create account' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-dusk/45">
            <span className="h-px flex-1 bg-ink/10" />
            or
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <Button
            className="w-full"
            loading={loading}
            onClick={handleGoogle}
            size="lg"
            type="button"
            variant="secondary"
          >
            <Globe className="h-4 w-4" />
            Continue with Google
          </Button>

          <p className="mt-6 text-sm text-dusk/70">
            {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
            <Link
              className="font-semibold text-teal underline underline-offset-4"
              to={isRegister ? '/login' : '/register'}
            >
              {isRegister ? 'Sign in here' : 'Create one'}
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}
