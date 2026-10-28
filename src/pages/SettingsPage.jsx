import {
  ArrowUpRight,
  Check,
  Cloud,
  Code2,
  LogOut,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
import { getDisplayName } from '../lib/utils'
import { openCreatorLink, CREATOR_URL } from '../lib/creatorLink'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

const appearanceOptions = [
  { value: 'light', label: 'Light', description: 'Bright and clear', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
  { value: 'system', label: 'System', description: 'Follow your device', icon: Monitor },
]

export const SettingsPage = () => {
  const { preference, setThemePreference } = useTheme()
  const { user, profile, logout } = useAuth()
  const displayName = getDisplayName(profile || user)
  const accountEmail = profile?.contactEmail || profile?.email || user?.email

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 sm:space-y-9">
      <header className="settings-hero overflow-hidden rounded-3xl border border-teal/10 px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Contri preferences</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-dusk sm:text-base">
          Make Contri feel right for you. Your appearance choice stays on this device.
        </p>
      </header>

      <section aria-labelledby="settings-appearance" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Personalize</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink" id="settings-appearance">Appearance</h2>
        </div>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">Theme</h3>
              <p className="mt-1 text-sm text-dusk">Choose how Contri looks across your screens.</p>
            </div>
            <Badge tone="teal">Saved on this device</Badge>
          </div>
          <div aria-label="Theme preference" className="mt-5 grid gap-2 sm:grid-cols-3" role="group">
            {appearanceOptions.map(({ value, label, description, icon: Icon }) => {
              const selected = preference === value
              return (
                <button
                  aria-pressed={selected}
                  className={`flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-teal ${
                    selected
                      ? 'border-teal bg-teal/10 text-teal shadow-sm'
                      : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                  key={value}
                  onClick={() => setThemePreference(value)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="mt-0.5 block text-xs text-dusk">{description}</span>
                  </span>
                  {selected ? <Check aria-hidden="true" className="h-4 w-4 flex-shrink-0" /> : null}
                </button>
              )
            })}
          </div>
        </Card>
      </section>

      <section aria-labelledby="settings-account" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Your access</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink" id="settings-account">Account</h2>
        </div>
        <Card className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-teal">
              <UserRound aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-semibold text-ink [overflow-wrap:anywhere]">{displayName}</p>
                {user?.isAnonymous ? <Badge tone="amber">Guest account</Badge> : null}
              </div>
              <p className="mt-0.5 break-all text-sm text-dusk">{accountEmail || 'No email on this account'}</p>
              <p className="mt-1 text-xs leading-5 text-dusk">
                {user?.isAnonymous
                  ? 'Link Google from your profile to make this guest account easier to recover.'
                  : 'Manage your profile details and sign-in options.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-ink shadow-sm transition hover:bg-sand focus-visible:outline-teal" to="/profile">
              Manage account
            </Link>
            <Button onClick={logout} type="button" variant="ghost">
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </Card>
      </section>

      <section aria-labelledby="settings-information" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">The app</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink" id="settings-information">App Information</h2>
        </div>
        <Card className="settings-info-surface">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-teal/10 font-display text-lg font-bold text-teal">C</span>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-ink">Contri</h3>
              <p className="text-sm text-dusk">Trip khatam. Hisab bhi khatam.</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dusk">
                Keep shared trip expenses together, see who owes whom, and record settlements with your group.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="teal">Trips</Badge>
                <Badge>Shared expenses</Badge>
                <Badge>Balances &amp; settlements</Badge>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="settings-built-by" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">People behind Contri</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink" id="settings-built-by">Built By</h2>
        </div>
        <Card className="settings-builder relative overflow-hidden p-0">
          <div className="settings-builder__terminal flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal/60" />
            <span className="ml-2 min-w-0 truncate font-mono text-xs text-dusk">contri / about-the-builder</span>
            <Cloud aria-hidden="true" className="ml-auto h-4 w-4 flex-shrink-0 text-teal" />
          </div>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-teal text-white shadow-sm">
                <Code2 aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Built by</p>
                <a
                  className="mt-1 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg font-display text-xl font-semibold text-ink underline decoration-teal/40 decoration-2 underline-offset-4 transition hover:text-teal focus-visible:outline-teal"
                  href={CREATOR_URL}
                  onClick={openCreatorLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="break-words [overflow-wrap:anywhere]">Tejas Mane</span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-teal" />
                </a>
                <p className="mt-1 text-sm text-dusk">Engineering <span aria-hidden="true">·</span> Automation <span aria-hidden="true">·</span> Cloud</p>
              </div>
            </div>
            <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-dusk sm:self-center">
              <span className="h-2 w-2 rounded-full bg-teal" />
              Built with care
            </span>
          </div>
        </Card>
      </section>
    </div>
  )
}
