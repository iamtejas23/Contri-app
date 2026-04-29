import { getInitials } from '../../lib/utils'

export const Avatar = ({ name, src, size = 'md' }) => {
  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-lg',
  }

  if (src) {
    return (
      <img
        alt={name}
        className={`${sizes[size]} rounded-2xl object-cover shadow-md shadow-ink/10`}
        src={src}
      />
    )
  }

  return (
    <div
      className={`${sizes[size]} flex items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-teal font-display font-bold text-white shadow-md shadow-ink/10`}
    >
      {getInitials(name)}
    </div>
  )
}
