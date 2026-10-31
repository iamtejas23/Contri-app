import { Users } from 'lucide-react'

import { MemberAvatar } from '../ui/MemberAvatar'

const sizeClasses = {
  compact: { avatar: 'h-6 w-6', stack: '-space-x-2', badge: 'h-6 w-6 text-[9px]', text: 'text-xs' },
  regular: { avatar: 'h-9 w-9', stack: '-space-x-2.5', badge: 'h-9 w-9 text-[11px]', text: 'text-sm' },
}

export const TripMembersIndicator = ({ members = [], maxVisible = 3, size = 'compact', className = '' }) => {
  const styles = sizeClasses[size] || sizeClasses.compact
  const visibleMembers = members.slice(0, maxVisible)
  const remaining = Math.max(0, members.length - visibleMembers.length)

  return (
    <span
      aria-label={`${members.length} ${members.length === 1 ? 'trip member' : 'trip members'}`}
      className={`inline-flex min-h-9 w-fit max-w-full shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 px-2.5 py-1.5 ${className}`}
      role="group"
    >
      {members.length ? (
        <span className={`inline-flex shrink-0 items-center ${styles.stack}`}>
          {visibleMembers.map((member, index) => (
            <MemberAvatar
              key={member.uid || `${member.name || 'member'}-${index}`}
              className={`relative ${styles.avatar}`}
              label={`${member.name || 'Member'} avatar`}
              member={member}
              name={member.name}
              size={size === 'regular' ? 'sm' : 'xs'}
              src={member.photoURL}
              uid={member.uid}
            />
          ))}
          {remaining > 0 ? (
            <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-orange-500 font-bold leading-none text-white ring-2 ring-sand ${styles.badge}`}>
              +{remaining}
            </span>
          ) : null}
        </span>
      ) : (
        <Users aria-hidden="true" className="h-4 w-4 shrink-0" />
      )}
      <span className={`whitespace-nowrap font-medium leading-none text-dusk ${styles.text}`}>
        {members.length} {members.length === 1 ? 'member' : 'members'}
      </span>
    </span>
  )
}
