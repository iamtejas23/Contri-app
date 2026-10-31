import { useState } from 'react'

import { Avatar } from './Avatar'
import { ProfilePreviewDialog } from './ProfilePreviewDialog'

export const MemberAvatar = ({ member, name, uid, src, size = 'md', className = '', label }) => {
  const [open, setOpen] = useState(false)
  const profile = member || { uid, name, photoURL: src }
  const displayName = profile.name || name || 'Traveler'

  return (
    <>
      <button
        aria-label={`View ${displayName}'s profile`}
        className={`inline-flex flex-shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${className}`}
        onClick={() => setOpen(true)}
        title={`View ${displayName}'s profile`}
        type="button"
      >
        <Avatar label={label || `${displayName} profile photo`} name={displayName} size={size} src={profile.photoURL || src} uid={profile.uid || uid} />
      </button>
      <ProfilePreviewDialog member={profile} onClose={() => setOpen(false)} open={open} />
    </>
  )
}
