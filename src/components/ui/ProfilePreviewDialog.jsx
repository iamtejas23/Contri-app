import { Shield, UserRound } from 'lucide-react'

import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { Modal } from './Modal'

export const ProfilePreviewDialog = ({ member, open, onClose, isSelf = false, accountType = '' }) => {
  if (!member) return null

  const name = member.name || member.displayName || 'Traveler'
  const memberType = member.isGuest || member.isAnonymous
    ? 'Guest member'
    : member.role === 'admin'
      ? 'Trip admin'
      : 'Trip member'

  return (
    <Modal
      description={isSelf ? 'Your Contri profile' : 'Trip member profile'}
      fullScreen={isSelf}
      onClose={onClose}
      open={open}
      title={isSelf ? 'Profile preview' : 'Member profile'}
    >
      <div className={`flex min-h-full flex-col items-center justify-center text-center ${isSelf ? 'py-10' : 'py-4'}`}>
        <Avatar
          label={`${name} profile photo`}
          name={name}
          size="2xl"
          src={member.photoURL || ''}
          uid={member.uid}
        />
        <h2 className="mt-6 max-w-full break-words font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">
          {name}
        </h2>

        {isSelf ? (
          <>
            <p className="mt-1 max-w-full break-all text-sm text-dusk">
              {member.email || member.contactEmail || 'No email linked'}
            </p>
            {member.isAnonymous ? <Badge className="mt-3" tone="amber">Guest account</Badge> : null}
            <div className="mt-8 grid w-full max-w-md gap-3 text-left">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <UserRound aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-blue-500" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-dusk">Account</p>
                  <p className="break-words text-sm font-medium text-ink">{accountType || (member.isAnonymous ? 'Guest account' : 'Signed-in account')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Shield aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-dusk">Profile photo</p>
                  <p className="break-words text-sm font-medium text-ink">{member.photoURL ? 'Available' : 'Initials shown when unavailable'}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-dusk">
            {memberType}
          </p>
        )}
      </div>
    </Modal>
  )
}
