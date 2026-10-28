import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { PublicOnlyRoute } from './routes/PublicOnlyRoute'
import { AuthPage } from './pages/AuthPage'
import { SettingsPage } from './pages/SettingsPage'
import { HomePage } from './pages/HomePage'
import { JoinTripPage } from './pages/JoinTripPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { TripPage } from './pages/TripPage'

function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthPage />} path="/login" />
          <Route element={<Navigate replace to="/login" />} path="/register" />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route element={<HomePage />} path="/" />
            <Route element={<ProfilePage />} path="/profile" />
            <Route element={<SettingsPage />} path="/settings" />
            <Route element={<Navigate replace to="/settings" />} path="/about" />
            <Route element={<JoinTripPage />} path="/join" />
            <Route element={<TripPage />} path="/trips/:tripId" />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '18px',
            background: '#143334',
            color: '#fffaf1',
          },
        }}
      />
    </>
  )
}

export default App
