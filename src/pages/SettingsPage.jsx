import {
  ArrowUpRight,
  Check,
  Cloud,
  Code2,
  LogOut,
  Monitor,
  Moon,
  Play,
  Sun,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
import { getDisplayName } from '../lib/utils'
import { openCreatorLink, openExternalLink, CREATOR_URL, GITHUB_URL } from '../lib/creatorLink'
import {
  isNotificationSoundEnabled,
  previewNotificationSound,
  setNotificationSoundEnabled,
} from '../lib/notificationSound'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { BrandMark } from '../components/BrandMark'

const appearanceOptions = [
  { value: 'light', label: 'Light', description: 'Bright and clear', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
  { value: 'system', label: 'System', description: 'Follow your device', icon: Monitor },
]

const GitHubMark = ({ className = '' }) => (
  <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.8 2.04 3.76 1.44.1-.73.4-1.22.7-1.5-2.48-.28-5.09-1.24-5.09-5.5 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.54 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.16 1.78 1.16 3 0 4.27-2.62 5.22-5.11 5.49.4.35.75 1.03.75 2.08v3.09c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
  </svg>
)

export const SettingsPage = () => {
  const { preference, setThemePreference } = useTheme()
  const { user, profile, logout } = useAuth()
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled)
  const displayName = getDisplayName(profile || user)
  const accountEmail = profile?.contactEmail || profile?.email || user?.email

  const handleSoundToggle = async () => {
    const nextValue = !soundEnabled
    const unlocked = await setNotificationSoundEnabled(nextValue)
    setSoundEnabled(nextValue)
    if (nextValue && !unlocked) {
      toast('Sound is enabled, but audio was blocked. Toggle it off and on again to retry.')
    }
  }

  const handleSoundPreview = async () => {
    const played = await previewNotificationSound()
    if (played) toast.success('Preview tone sent. Check media volume and silent mode if you cannot hear it.')
    else toast.error('Audio is unavailable. Check device media volume and try again.')
  }

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
          <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${soundEnabled ? 'bg-teal/10 text-teal' : 'bg-slate-100 text-dusk'}`}>
                {soundEnabled
                  ? <Volume2 aria-hidden="true" className="h-5 w-5" />
                  : <VolumeX aria-hidden="true" className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">Sound On/Off</span>
                <span className="mt-0.5 block text-xs leading-5 text-dusk">Play a quiet chime for new updates while Contri is open.</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSoundPreview} size="sm" type="button" variant="secondary">
                <Play aria-hidden="true" className="h-4 w-4" />
                Test sound
              </Button>
              <button
                aria-checked={soundEnabled}
                aria-label={soundEnabled ? 'Sound On' : 'Sound Off'}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-teal ${soundEnabled ? 'bg-teal' : 'bg-slate-300'}`}
                onClick={handleSoundToggle}
                role="switch"
                type="button"
              >
                <span className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${soundEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
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
            <BrandMark className="h-11 w-11 rounded-2xl" />
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold lowercase text-ink">contri</h3>
              <p className="text-sm text-dusk">Travel together. Split together.</p>
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
                <a
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-dusk transition hover:text-ink focus-visible:outline-teal"
                  href={GITHUB_URL}
                  onClick={(event) => openExternalLink(event, GITHUB_URL)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <GitHubMark className="h-4 w-4" />
                  <span>@iamtejas23</span>
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
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
