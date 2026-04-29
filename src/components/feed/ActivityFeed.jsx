import { getActivityText } from '../../lib/activity'
import { timeAgo } from '../../lib/date'
import { Avatar } from '../ui/Avatar'
import { EmptyState } from '../ui/EmptyState'

export const ActivityFeed = ({ activity, membersMap, currency }) => {
  if (!activity.length) {
    return (
      <EmptyState
        description="As expenses and settlements happen, the trip feed will keep everyone in sync."
        title="No activity yet"
      />
    )
  }

  return (
    <div className="space-y-4">
      {activity.map((item) => (
        <div
          key={item.id}
          className="flex gap-4 rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-float backdrop-blur"
        >
          <Avatar name={item.actorName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-6 text-dusk">
              {getActivityText(item, membersMap, currency)}
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-dusk/55">
              {timeAgo(item.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
