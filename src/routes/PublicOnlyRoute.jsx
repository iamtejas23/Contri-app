import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { LoadingScreen } from '../components/ui/LoadingScreen'

export const PublicOnlyRoute = () => {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  const isMobilePortal =
    location.pathname === '/login' &&
    new URLSearchParams(location.search).get('mobile') === '1'

  if (user && !user.isAnonymous && !isMobilePortal) {
    return <Navigate replace to={location.state?.from || '/'} />
  }

  return <Outlet />
}
