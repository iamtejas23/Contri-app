import { useCallback, useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

import {
  persistThemePreference,
  readThemePreference,
  resolveTheme,
} from '../lib/theme'

import { ThemeContext } from './theme-context'

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(readThemePreference)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = resolveTheme(preference, media.matches)
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved

      if (Capacitor.isNativePlatform()) {
        const backgroundColor = resolved === 'dark' ? '#0B1220' : '#F8FAFC'
        StatusBar.setBackgroundColor({ color: backgroundColor }).catch(() => {})
        StatusBar.setStyle({ style: resolved === 'dark' ? Style.Light : Style.Dark }).catch(() => {})
      }
    }

    applyTheme()
    media.addEventListener?.('change', applyTheme)
    return () => media.removeEventListener?.('change', applyTheme)
  }, [preference])

  const setThemePreference = useCallback((nextPreference) => {
    setPreference(persistThemePreference(nextPreference))
  }, [])

  const value = useMemo(() => ({
    preference,
    setThemePreference,
  }), [preference, setThemePreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
