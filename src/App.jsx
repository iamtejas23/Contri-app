import { useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Filesystem } from '@capacitor/filesystem'
import toast from 'react-hot-toast'
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
import { cameraPhotoToReceiptFile } from './lib/cameraReceiptFile'
import { receiptUploadQueue } from './services/receiptUploadQueue'
import { clearPendingReceiptCapture, PENDING_CAMERA_RECEIPT_KEY } from './services/receiptCamera'
import { useAuth } from './context/useAuth'
import { PushNotificationsProvider } from './context/PushNotificationsContext'

function App() {
  const { user } = useAuth()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let active = true
    let listener
    CapacitorApp.addListener('appRestoredResult', async (event) => {
      if (event.pluginId !== 'Camera' || event.methodName !== 'getPhoto') return
      let target
      try {
        target = JSON.parse(globalThis.localStorage?.getItem(PENDING_CAMERA_RECEIPT_KEY) || 'null')
      } catch { return }
      clearPendingReceiptCapture()
      if (!event.success) return
      if (!target?.tripId || !target?.expenseId || Date.now() - Number(target.startedAt || 0) > 60 * 60 * 1000) return
      try {
        const file = await cameraPhotoToReceiptFile(event.data, {
          readFile: (options) => Filesystem.readFile(options),
        })
        receiptUploadQueue.enqueue({ tripId: target.tripId, expenseId: target.expenseId, file })
        toast.success('Receipt captured. Upload started.')
      } catch (error) {
        toast.error(error?.message || 'The captured receipt could not be added. Try again or use Add Images.')
      }
    }).then((handle) => {
      if (!active) handle.remove()
      else listener = handle
    }).catch(() => {})

    return () => {
      active = false
      listener?.remove()
    }
  }, [])

  return (
    <>
      <PushNotificationsProvider user={user}>
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
            <Route element={<JoinTripPage />} path="/join/:tripId" />
            <Route element={<TripPage />} path="/trips/:tripId" />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>
      </PushNotificationsProvider>

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
