export const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-mesh px-6">
    <div className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-white/75 p-8 text-center shadow-float backdrop-blur">
      <div className="mx-auto mb-5 h-16 w-16 animate-pulse rounded-full bg-gradient-to-br from-coral/30 to-teal/30" />
      <p className="font-display text-2xl font-bold text-ink">Contri-app</p>
      <p className="mt-2 text-sm text-dusk/70">Loading your trip board...</p>
    </div>
  </div>
)
