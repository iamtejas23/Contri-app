import { Camera, Mail, Shield, User } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'

import { useAuth } from '../context/useAuth'
import { isValidUpiId } from '../lib/upi'
import { getDisplayName } from '../lib/utils'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export const ProfilePage = () => {
  const { user, profile, updateProfileDetails, loginWithGoogle, loginWithNativeGoogle } = useAuth()
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)

  const liveValues = {
    name: profile?.name || user?.displayName || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
    upiId: profile?.upiId || '',
  }
  const form = draft || liveValues

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    if (form.upiId && !isValidUpiId(form.upiId)) {
      toast.error('Enter a UPI ID like name@okhdfcbank.')
      return
    }

    setLoading(true)
    try {
      await updateProfileDetails(form)
      setDraft(null)
      toast.success('Profile updated.')
    } catch {
      /* service layer shows toast */
    } finally {
      setLoading(false)
    }
  }

  const handleLinkGoogle = async () => {
    if (linking) return
    setLinking(true)
    try {
      if (Capacitor.getPlatform() === 'android') await loginWithNativeGoogle()
      else await loginWithGoogle()
      toast.success('Google is linked to this guest account.')
    } catch {
      // The auth service reports provider errors and leaves the guest session intact.
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Account</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">Your profile</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
        {/* Identity card */}
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="relative">
            <Avatar name={form.name || getDisplayName(profile || user)} size="lg" src={form.photoURL} />
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-teal shadow-md">
              <Camera className="h-3 w-3 text-white" />
            </div>
          </div>

          <div>
            <p className="font-display text-xl font-bold text-ink">
              {form.name || getDisplayName(profile || user)}
            </p>
            <p className="mt-1 text-sm text-dusk">{profile?.contactEmail || profile?.email || user?.email || ''}</p>
            {user?.isAnonymous ? <Badge className="mt-2" tone="amber">Guest account</Badge> : null}
          </div>

          <div className="w-full space-y-2 text-left">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <User className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="truncate text-sm text-ink">
                {form.name || getDisplayName(profile || user)}
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <Mail className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="truncate text-sm text-ink">
                {profile?.email || profile?.contactEmail || user?.email || ''}
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <Shield className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <Badge tone={user?.isAnonymous ? 'amber' : 'teal'}>
                {user?.isAnonymous ? 'Guest · not verified' : 'Verified'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Edit form */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Edit profile</h2>
          <p className="mt-1 text-sm text-dusk">
            Your name shows on every trip. Your UPI ID lets friends pay you in one tap.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Display name"
              onChange={(e) =>
                setDraft((c) => ({ ...(c || liveValues), name: e.target.value }))
              }
              placeholder="Your name"
              required
              value={form.name}
            />
            <Input
              label="Photo URL"
              onChange={(e) =>
                setDraft((c) => ({ ...(c || liveValues), photoURL: e.target.value }))
              }
              placeholder="https://..."
              type="url"
              value={form.photoURL}
            />
            {form.photoURL ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Avatar name={form.name} size="sm" src={form.photoURL} />
                <span className="text-sm text-dusk">Photo preview</span>
              </div>
            ) : null}
            <Input
              hint="Example: yourname@okhdfcbank. Used only when someone settles with you."
              label="UPI ID"
              onChange={(e) =>
                setDraft((c) => ({ ...(c || liveValues), upiId: e.target.value.trim() }))
              }
              placeholder="name@okhdfcbank"
              value={form.upiId}
            />
            <Input disabled label="Email address" value={profile?.email || profile?.contactEmail || user?.email || ''} />

            <div className="flex gap-3 pt-2">
              <Button loading={loading} type="submit">
                Save changes
              </Button>
              {draft ? (
                <Button onClick={() => setDraft(null)} type="button" variant="secondary">
                  Discard
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>

      {user?.isAnonymous ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-ink">Keep this account recoverable</h2>
              <p className="mt-1 text-sm text-dusk">
                This guest uses Firebase Anonymous Authentication. Link Google to preserve this same account and its trips if you change devices.
              </p>
            </div>
            <Button loading={linking} onClick={handleLinkGoogle} type="button">
              Link Google account
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
