import { useState } from 'react'

import { getInitials } from '../../lib/utils'

const sizes = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

const fallbackColors = [
  'bg-emerald-700',
  'bg-blue-700',
  'bg-violet-700',
  'bg-cyan-700',
  'bg-amber-700',
  'bg-rose-700',
]

const getColorIndex = (value) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % fallbackColors.length
}

export const Avatar = ({ name, src, uid, size = 'md', className = '', label }) => {
  const [failedSrc, setFailedSrc] = useState('')
  const [loadedSrc, setLoadedSrc] = useState('')
  const s = sizes[size] ?? sizes.md
  const identity = uid || name || 'unknown-member'
  const accessibleName = label || (name ? `${name} profile photo` : 'Member without a profile photo')
  const fallback = getInitials(name, '?')
  const fallbackClass = `${s} flex flex-shrink-0 items-center justify-center rounded-full font-display font-bold text-white ring-2 ring-sand ${fallbackColors[getColorIndex(identity)]} ${className}`

  if (src && failedSrc !== src) {
    return (
      <span aria-label={accessibleName} className={`${s} relative inline-flex flex-shrink-0 items-center justify-center rounded-full ring-2 ring-sand ${fallbackColors[getColorIndex(identity)]} ${className}`} role="img">
        {loadedSrc !== src ? <span aria-hidden="true" className="font-display font-bold text-white">{fallback}</span> : null}
        <img
          alt=""
          className={`absolute inset-0 h-full w-full rounded-full object-cover transition-opacity ${loadedSrc === src ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          onLoad={() => setLoadedSrc(src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      </span>
    )
  }

  return (
    <div
      aria-label={label || `${name || 'Unknown member'} avatar`}
      className={fallbackClass}
      role="img"
    >
      {fallback}
    </div>
  )
}
