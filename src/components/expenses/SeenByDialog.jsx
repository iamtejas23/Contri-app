import { Eye } from 'lucide-react'

import { sortExpenseViews } from '../../services/expenseViews.js'
import { Avatar } from '../ui/Avatar'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { formatDate } from '../../lib/date'

export const SeenByDialog = ({ open, onClose, views = [], membersMap = {} }) => {
  const orderedViews = sortExpenseViews(views)

  return (
    <Modal
      bottomSheet
      description={`${orderedViews.length} ${orderedViews.length === 1 ? 'trip member has' : 'trip members have'} opened this expense`}
      onClose={onClose}
      open={open}
      size="compact"
      title="Seen by"
    >
      {orderedViews.length ? (
        <ul aria-label="Members who viewed this expense" className="space-y-2">
          {orderedViews.map((view) => {
            const member = membersMap[view.uid]
            const name = member?.name || 'Trip member'
            return (
              <li className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3" key={view.uid}>
                <Avatar label={`${name} profile photo`} name={name} size="md" src={member?.photoURL} uid={view.uid} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{name}</p>
                  <p className="mt-0.5 text-xs text-dusk">
                    {view.viewedAt ? formatDate(view.viewedAt, 'dd MMM yyyy, h:mm a') : 'Just viewed'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState description="No one has opened this expense yet." icon={Eye} title="No views yet" />
      )}
    </Modal>
  )
}
