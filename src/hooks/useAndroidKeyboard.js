import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const isTextEntry = (element) =>
  element instanceof HTMLElement &&
  element.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]')

const getScrollContainer = (element) => {
  let parent = element?.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(parent)
    if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight + 1) return parent
    parent = parent.parentElement
  }
  return null
}

const keepFocusedFieldVisible = () => {
  const activeElement = document.activeElement
  if (!isTextEntry(activeElement)) return

  window.requestAnimationFrame(() => {
    if (!activeElement.isConnected || document.activeElement !== activeElement) return
    const viewport = window.visualViewport
    const viewportTop = viewport?.offsetTop || 0
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight)
    const safeGap = 16
    const rect = activeElement.getBoundingClientRect()
    const container = getScrollContainer(activeElement)

    if (rect.bottom > viewportBottom - safeGap) {
      const distance = rect.bottom - viewportBottom + safeGap
      if (container) container.scrollTop += distance
      else window.scrollBy(0, distance)
    } else if (rect.top < viewportTop + safeGap) {
      const distance = rect.top - viewportTop - safeGap
      if (container) container.scrollTop += distance
      else window.scrollBy(0, distance)
    }
  })
}

export const useAndroidKeyboard = () => {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined

    let disposed = false
    let keyboardEventOpen = false
    let baselineHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0)
    let baselineWidth = window.innerWidth
    const subscriptions = []
    const root = document.documentElement
    const previousViewportHeight = root.style.getPropertyValue('--app-viewport-height')
    const hadKeyboardDataset = Object.hasOwn(root.dataset, 'keyboardOpen')
    const previousKeyboardDataset = root.dataset.keyboardOpen

    const getVisibleHeight = () => window.visualViewport?.height || window.innerHeight
    const setViewportHeight = () => {
      const height = getVisibleHeight()
      if (height > 0) root.style.setProperty('--app-viewport-height', `${Math.round(height)}px`)
      if (!keyboardEventOpen) {
        if (Math.abs(window.innerWidth - baselineWidth) > 100) {
          baselineWidth = window.innerWidth
          baselineHeight = height
        } else if (height > baselineHeight) {
          baselineHeight = height
        }
      }
      const viewportIndicatesKeyboard = baselineHeight - height > 120
      const keyboardOpen = keyboardEventOpen || viewportIndicatesKeyboard
      if (keyboardOpen) root.dataset.keyboardOpen = 'true'
      else delete root.dataset.keyboardOpen
      if (keyboardOpen) keepFocusedFieldVisible()
    }

    const onKeyboardShow = () => {
      keyboardEventOpen = true
      setViewportHeight()
      keepFocusedFieldVisible()
    }
    const onKeyboardHide = () => {
      keyboardEventOpen = false
      window.requestAnimationFrame(setViewportHeight)
    }
    const onFocusIn = (event) => {
      if (isTextEntry(event.target)) keepFocusedFieldVisible()
    }

    setViewportHeight()
    Promise.allSettled([
      Keyboard.addListener('keyboardDidShow', onKeyboardShow),
      Keyboard.addListener('keyboardDidHide', onKeyboardHide),
    ]).then((results) => {
      const handles = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
      if (disposed) handles.forEach((handle) => handle.remove())
      else subscriptions.push(...handles)
    })

    window.visualViewport?.addEventListener('resize', setViewportHeight)
    window.addEventListener('resize', setViewportHeight)
    document.addEventListener('focusin', onFocusIn)

    return () => {
      disposed = true
      subscriptions.forEach((handle) => handle.remove())
      window.visualViewport?.removeEventListener('resize', setViewportHeight)
      window.removeEventListener('resize', setViewportHeight)
      document.removeEventListener('focusin', onFocusIn)
      if (previousViewportHeight) root.style.setProperty('--app-viewport-height', previousViewportHeight)
      else root.style.removeProperty('--app-viewport-height')
      if (hadKeyboardDataset) root.dataset.keyboardOpen = previousKeyboardDataset
      else delete root.dataset.keyboardOpen
    }
  }, [])
}
