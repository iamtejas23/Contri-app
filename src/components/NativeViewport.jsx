import { useAndroidKeyboard } from '../hooks/useAndroidKeyboard'

export const NativeViewport = ({ children }) => {
  useAndroidKeyboard()
  return children
}
