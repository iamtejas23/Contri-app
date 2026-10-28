export const THEME_STORAGE_KEY = 'contri-theme'
export const THEME_PREFERENCES = ['system', 'light', 'dark']

export const normalizeThemePreference = (value) =>
  THEME_PREFERENCES.includes(value) ? value : 'system'

export const resolveTheme = (preference, prefersDark = false) => {
  const normalized = normalizeThemePreference(preference)
  return normalized === 'system' ? (prefersDark ? 'dark' : 'light') : normalized
}

export const readThemePreference = (storage) => {
  try {
    const availableStorage = storage ?? globalThis.localStorage
    return normalizeThemePreference(availableStorage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export const persistThemePreference = (preference, storage) => {
  const normalized = normalizeThemePreference(preference)
  try {
    const availableStorage = storage ?? globalThis.localStorage
    availableStorage?.setItem(THEME_STORAGE_KEY, normalized)
  } catch {
    // Keep the selected theme active for this session if storage is unavailable.
  }
  return normalized
}
