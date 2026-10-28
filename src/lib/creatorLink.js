import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

export const CREATOR_URL = 'https://tejasmane.netlify.app/'

export const openCreatorLink = async (event) => {
  if (!Capacitor.isNativePlatform()) return

  event.preventDefault()
  try {
    await AppLauncher.openUrl({ url: CREATOR_URL })
  } catch {
    toast.error('Could not open the website. Please try again.')
  }
}
