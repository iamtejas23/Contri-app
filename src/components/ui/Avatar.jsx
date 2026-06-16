import { useState } from 'react'

import { getInitials } from '../../lib/utils'

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
}

export const Avatar = ({ name, src, size = 'md' }) => {
  const [imgError, setImgError] = useState(false)
  const s = sizes[size] ?? sizes.md

  if (src && !imgError) {
    return (
      <img
        alt={name}
        className={`${s} flex-shrink-0 rounded-xl object-cover ring-2 ring-white`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={src}
      />
    )
  }

  return (
    <div
      className={`${s} flex flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-teal/70 font-display font-bold text-white ring-2 ring-white`}
    >
      {getInitials(name)}
    </div>
  )
}
