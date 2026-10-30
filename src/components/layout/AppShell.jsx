import { LogOut, Map, Settings2, UserCircle2 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../../context/useAuth'
import { getDisplayName } from '../../lib/utils'
import { Avatar } from '../ui/Avatar'
import { BrandMark } from '../BrandMark'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { NotificationCenter } from '../notifications/NotificationCenter'

const navItems = [
  { to: '/', label: 'Trips', icon: Map, tint: 'text-violet-500' },
  { to: '/profile', label: 'Profile', icon: UserCircle2, tint: 'text-blue-500' },
  { to: '/settings', label: 'Settings', icon: Settings2, tint: 'text-zinc-500' },
]

export const AppShell = () => {
  const { profile, user, logout } = useAuth()
  const displayName = getDisplayName(profile || user)

  return (
      <div className="min-h-dvh bg-sand text-ink">
      {/* Top header */}
      <header className="app-topbar sticky top-0 z-30 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-3 sm:gap-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <NavLink aria-label="contri home" className="flex min-w-0 items-center gap-2" to="/">
            <BrandMark className="h-8 w-8 rounded-[10px]" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold lowercase leading-none tracking-tight text-ink">contri</p>
              <p className="mt-1 hidden whitespace-nowrap text-[10px] leading-none text-dusk lg:block">
                Travel together. Split together.
              </p>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map(({ to, label, icon: Icon, tint }) => (
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
                <Icon className={`h-4 w-4 ${tint}`} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink leading-none">
                {displayName}
              </p>
              <p className="mt-0.5 text-xs text-dusk">{profile?.email || 'Traveler'}</p>
            </div>
            {user?.isAnonymous ? <Badge className="hidden sm:inline-flex" tone="amber">Guest</Badge> : null}
            <NotificationCenter currentUserPhotoURL={profile?.photoURL || user?.photoURL} uid={user?.uid} />
            <NavLink
              aria-label={`Open profile for ${displayName}`}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition hover:bg-slate-100 focus-visible:outline-teal"
              title="Open your profile"
              to="/profile"
            >
              <Avatar name={displayName} size="sm" src={profile?.photoURL || user?.photoURL} uid={user?.uid} />
            </NavLink>
            <Button aria-label="Sign out" onClick={logout} size="sm" type="button" variant="secondary">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="app-main mx-auto min-w-0 max-w-7xl px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-24 lg:px-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="app-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex items-center justify-around px-[max(1rem,env(safe-area-inset-left))] py-1 pr-[max(1rem,env(safe-area-inset-right))]">
          {navItems.map(({ to, label, icon: Icon, tint }) => (
            <NavLink
              key={to}
              className={({ isActive }) =>
                `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-teal' : `text-slate-400 hover:text-ink ${tint}`
                }`
              }
              to={to}
            >
              <Icon className={`h-5 w-5 ${tint}`} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
