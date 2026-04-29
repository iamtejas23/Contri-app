import { Home, LogOut, UserCircle2 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../../context/useAuth'
import { getDisplayName } from '../../lib/utils'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

const navItems = [
  { to: '/', label: 'Trips', icon: Home },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
]

export const AppShell = () => {
  const { profile, logout } = useAuth()

  return (
    <div className="min-h-screen bg-mesh text-ink">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 mx-auto h-[420px] max-w-7xl rounded-b-[4rem] bg-gradient-to-br from-coral/12 via-transparent to-teal/12 blur-3xl" />

      <header className="sticky top-0 z-30 border-b border-white/40 bg-sand/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <NavLink className="min-w-0" to="/">
            <p className="font-display text-2xl font-bold text-ink">Contri-app</p>
            <p className="truncate text-xs uppercase tracking-[0.22em] text-dusk/60">
              Split trips, not friendships.
            </p>
          </NavLink>

          <div className="hidden items-center gap-2 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white text-ink shadow-md' : 'text-dusk/70 hover:bg-white/70'
                  }`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{getDisplayName(profile)}</p>
              <p className="text-xs text-dusk/60">{profile?.email || 'Traveler'}</p>
            </div>
            <Avatar name={getDisplayName(profile)} size="sm" src={profile?.photoURL} />
            <Button onClick={logout} size="sm" type="button" variant="secondary">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-4 z-30 px-4 sm:hidden">
        <div className="mx-auto flex max-w-sm items-center justify-around rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-float backdrop-blur">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `flex min-w-[110px] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-ink text-white' : 'text-dusk/70'
                  }`
                }
                to={item.to}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
