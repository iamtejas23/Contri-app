export const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-sand px-6">
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
        <div className="absolute inset-0 rounded-full border-4 border-teal border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-ink">Contri-app</p>
        <p className="mt-1 text-sm text-dusk">Loading your trip board…</p>
      </div>
    </div>
  </div>
)
