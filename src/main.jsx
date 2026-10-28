import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { NativeViewport } from './components/NativeViewport'
import './index.css'
import App from './App.jsx'

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#F8FAFC' }).catch(() => {})
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <NativeViewport>
            <App />
          </NativeViewport>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
