export const BrandMark = ({ className = 'h-8 w-8' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl bg-[#101010] text-white ring-1 ring-white/10 ${className}`}
  >
    <img alt="" className="h-full w-full rounded-[inherit] object-cover" height="1024" src="/contri-symbol.png" width="1024" />
  </span>
)
