import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  normalizeThemePreference,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from '../src/lib/theme.js'

test('theme preferences persist locally and restore on a fresh app session', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  assert.equal(persistThemePreference('dark', storage), 'dark')
  assert.equal(values.get(THEME_STORAGE_KEY), 'dark')
  assert.equal(readThemePreference(storage), 'dark')
})

test('system appearance follows device preference while explicit themes take precedence', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')
})

test('invalid or inaccessible theme preferences safely fall back to system', () => {
  assert.equal(normalizeThemePreference('sepia'), 'system')
  assert.equal(readThemePreference({ getItem: () => 'sepia' }), 'system')
  assert.equal(readThemePreference({ getItem: () => { throw new Error('blocked') } }), 'system')
  assert.equal(persistThemePreference('sepia', { setItem: () => { throw new Error('blocked') } }), 'system')
})
