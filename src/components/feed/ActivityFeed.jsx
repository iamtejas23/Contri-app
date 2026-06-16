import { Activity } from 'lucide-react'

import { getActivityText } from '../../lib/activity'
import { timeAgo } from '../../lib/date'
import { Avatar } from '../ui/Avatar'
import { EmptyState } from '../ui/EmptyState'

export const ActivityFeed = ({ activity, membersMap, currency }) => {
  if (!activity.length) {
    return (
      <EmptyState
        description="As expenses and settlements happen, the trip feed will keep everyone in sync."
        icon={Activity}
        title="No activity yet"
      />
    )
  }

  return (
    <div className="space-y-0">
      {activity.map((item, index) => (
        <div key={item.id} className="relative flex gap-4 pb-4">
          {index < activity.length - 1 ? (
            <div className="absolute bottom-0 left-[18px] top-11 w-px bg-slate-200" />
          ) : null}

          <div className="relative z-10 mt-1 flex-shrink-0">
            <Avatar name={item.actorName} size="sm" />
          </div>

          <div className="flex-1 rounded-xl border border-slate-100 bg-white p-4 shadow-float">
            <p className="text-sm leading-relaxed text-ink">
              {getActivityText(item, membersMap, currency)}
            </p>
            <p className="mt-1.5 text-xs font-medium text-dusk">
              {timeAgo(item.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
