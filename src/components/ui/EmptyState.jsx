import { Inbox } from 'lucide-react'

import { Button } from './Button'

export const EmptyState = ({ title, description, actionLabel, onAction, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon className="h-7 w-7" />
    </div>
    <p className="font-display text-xl font-semibold text-ink">{title}</p>
    <p className="mx-auto mt-2 max-w-sm text-sm text-dusk">{description}</p>
    {actionLabel && onAction ? (
      <Button className="mt-6" onClick={onAction} type="button">
        {actionLabel}
      </Button>
    ) : null}
  </div>
)
