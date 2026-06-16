import { LogOut, Map, UserCircle2 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../../context/useAuth'
import { getDisplayName } from '../../lib/utils'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

const navItems = [
  { to: '/', label: 'Trips', icon: Map },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
]

export const AppShell = () => {
  const { profile, logout } = useAuth()

  return (
    <div className="min-h-screen bg-sand text-ink">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <NavLink className="flex items-center gap-2.5 min-w-0" to="/">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal text-sm font-bold text-white">
              C
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-base font-semibold text-ink leading-none">Contri-app</p>
              <p className="text-[10px] uppercase tracking-widest text-dusk leading-none mt-0.5">
                Split trips, not friendships
              </p>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal/10 text-teal'
                      : 'text-dusk hover:bg-slate-100 hover:text-ink'
                  }`
                }
                to={to}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink leading-none">
                {getDisplayName(profile)}
              </p>
              <p className="mt-0.5 text-xs text-dusk">{profile?.email || 'Traveler'}</p>
            </div>
            <Avatar name={getDisplayName(profile)} size="sm" src={profile?.photoURL} />
            <Button onClick={logout} size="sm" type="button" variant="secondary">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white sm:hidden">
        <div className="flex items-center justify-around px-4 py-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl px-6 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-teal' : 'text-slate-400 hover:text-ink'
                }`
              }
              to={to}
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
