import { useState } from 'react'
import toast from 'react-hot-toast'

import { useAuth } from '../context/useAuth'
import { getDisplayName } from '../lib/utils'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export const ProfilePage = () => {
  const { user, profile, updateProfileDetails } = useAuth()
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const liveValues = {
    name: profile?.name || user?.displayName || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  }
  const form = draft || liveValues

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      await updateProfileDetails(form)
      setDraft(null)
      toast.success('Profile updated.')
    } catch {
      // Service layer already shows a toast for Firebase failures.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
      <Card className="overflow-hidden bg-gradient-to-br from-ink via-dusk to-teal p-8 text-white">
        <p className="text-sm uppercase tracking-[0.22em] text-white/65">Your identity</p>
        <div className="mt-8 flex items-center gap-5">
          <Avatar name={form.name || getDisplayName(profile || user)} size="lg" src={form.photoURL} />
          <div>
            <h1 className="font-display text-4xl font-bold">
              {form.name || getDisplayName(profile || user)}
            </h1>
            <p className="mt-2 text-sm text-white/75">{profile?.email || user?.email}</p>
          </div>
        </div>
        <div className="mt-8 rounded-[1.75rem] bg-white/10 p-5 backdrop-blur">
          <p className="text-sm leading-6 text-white/80">
            Your avatar falls back to initials automatically, so changing your display
            name refreshes the initials preview instantly. You can also add a direct
            image URL if you prefer a photo.
          </p>
        </div>
      </Card>

      <Card>
        <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Edit profile</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-ink">
          Keep the group roster recognizable
        </h2>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <Input
            label="Display name"
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || liveValues),
                name: event.target.value,
              }))
            }
            placeholder="Your name"
            required
            value={form.name}
          />
          <Input
            label="Photo URL"
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || liveValues),
                photoURL: event.target.value,
              }))
            }
            placeholder="https://..."
            value={form.photoURL}
          />
          <Input disabled label="Email" value={profile?.email || user?.email || ''} />
          <Button loading={loading} type="submit">
            Save profile
          </Button>
        </form>
      </Card>
    </div>
  )
}
