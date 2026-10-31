import { Eye } from 'lucide-react'

import { Avatar } from '../ui/Avatar'

export const SeenByIndicator = ({ views = [], membersMap = {}, onClick }) => (
  <button
    aria-label={`Seen by ${views.length} ${views.length === 1 ? 'member' : 'members'}`}
    className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-xl px-2 py-1 text-left text-xs text-dusk transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
    disabled={!views.length}
    onClick={onClick}
    type="button"
  >
    <Eye aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
    <span className="flex min-w-0 flex-shrink-0 items-center -space-x-2">
      {views.slice(0, 3).map((view) => {
        const member = membersMap[view.uid]
        return (
          <Avatar
            className="h-6 w-6 ring-2 ring-sand"
            key={view.uid}
            label={`${member?.name || 'Trip member'} viewed this expense`}
            name={member?.name || 'Trip member'}
            size="xs"
            src={member?.photoURL}
            uid={view.uid}
          />
        )
      })}
      {views.length > 3 ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-dusk ring-2 ring-sand">+{views.length - 3}</span>
      ) : null}
    </span>
    <span className="truncate">{views.length ? 'Seen by' : 'Not viewed yet'}</span>
  </button>
)
