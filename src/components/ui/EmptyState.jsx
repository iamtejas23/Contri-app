import { Button } from './Button'

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="rounded-[2rem] border border-dashed border-ink/15 bg-white/55 px-6 py-10 text-center">
    <p className="font-display text-2xl font-bold text-ink">{title}</p>
    <p className="mx-auto mt-2 max-w-lg text-sm text-dusk/70">{description}</p>
    {actionLabel && onAction ? (
      <Button className="mt-5" onClick={onAction} type="button">
        {actionLabel}
      </Button>
    ) : null}
  </div>
)
