import { ExternalLink, Heart, Map, ReceiptText, UsersRound } from 'lucide-react'
import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

const creatorWebsite = 'https://tejasmane.netlify.app/'

const openCreatorWebsite = async (event) => {
  if (!Capacitor.isNativePlatform()) return

  event.preventDefault()
  try {
    await AppLauncher.openUrl({ url: creatorWebsite })
  } catch {
    toast.error('Could not open the website. Please try again.')
  }
}

const features = [
  { icon: Map, text: 'Keep trip details and plans together.' },
  { icon: ReceiptText, text: 'Track shared expenses as they happen.' },
  { icon: UsersRound, text: 'See balances and settle up with your group.' },
]

export const AboutPage = () => (
  <div className="mx-auto w-full max-w-3xl space-y-6 sm:space-y-8">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">About Contri</p>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Good trips. Clear hisab.</h1>
      <p className="max-w-2xl text-sm leading-6 text-dusk sm:text-base">
        Contri helps friends keep trip expenses, group balances, and settlements in one simple place.
      </p>
    </header>

    <section aria-label="What Contri helps with" className="grid gap-3 sm:grid-cols-3">
      {features.map(({ icon: Icon, text }) => (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:flex-col sm:p-5" key={text}>
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="pt-1 text-sm leading-5 text-dusk sm:pt-0">{text}</p>
        </div>
      ))}
    </section>

    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <span aria-hidden="true" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-teal font-display text-xl font-bold text-white">C</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Built by</p>
          <a
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg font-display text-lg font-semibold text-ink underline decoration-teal/40 decoration-2 underline-offset-4 transition hover:text-teal focus-visible:outline-teal"
            href={creatorWebsite}
            onClick={openCreatorWebsite}
            rel="noopener noreferrer"
            target="_blank"
          >
            Tejas Mane
            <ExternalLink aria-hidden="true" className="h-4 w-4 text-teal" />
          </a>
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-dusk">
        Made for trips worth remembering <Heart aria-hidden="true" className="h-4 w-4 fill-coral text-coral" />
      </p>
    </section>
  </div>
)
