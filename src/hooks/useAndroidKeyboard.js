import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const isTextEntry = (element) =>
  element instanceof HTMLElement &&
  (element.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]'))

const keepFocusedFieldVisible = () => {
  const activeElement = document.activeElement
  if (!isTextEntry(activeElement)) return

  window.requestAnimationFrame(() => {
    activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  })
}

export const useAndroidKeyboard = () => {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined

    let disposed = false
    const subscriptions = []
    const root = document.documentElement
    const updateViewportHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight
      if (height > 0) root.style.setProperty('--app-viewport-height', `${Math.round(height)}px`)
    }
    const show = () => {
      root.dataset.keyboardOpen = 'true'
      updateViewportHeight()
      keepFocusedFieldVisible()
    }
    const hide = () => {
      delete root.dataset.keyboardOpen
      window.requestAnimationFrame(updateViewportHeight)
    }
    const handleViewportResize = () => {
      updateViewportHeight()
      if (root.dataset.keyboardOpen) keepFocusedFieldVisible()
    }

    updateViewportHeight()

    Promise.allSettled([
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardDidHide', hide),
    ]).then((results) => {
      const handles = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
      if (disposed) handles.forEach((handle) => handle.remove())
      else subscriptions.push(...handles)
    })

    window.visualViewport?.addEventListener('resize', handleViewportResize)

    return () => {
      disposed = true
      subscriptions.forEach((handle) => handle.remove())
      window.visualViewport?.removeEventListener('resize', handleViewportResize)
      hide()
      root.style.removeProperty('--app-viewport-height')
    }
  }, [])
}
