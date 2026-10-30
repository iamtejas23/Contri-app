import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

export const CREATOR_URL = 'https://tejasmane.netlify.app/'
export const GITHUB_URL = 'https://github.com/iamtejas23'

export const openExternalLink = async (event, url) => {
  if (!Capacitor.isNativePlatform()) return

  event.preventDefault()
  try {
    await AppLauncher.openUrl({ url })
  } catch {
    toast.error('Could not open the link. Please try again.')
  }
}

export const openCreatorLink = (event) => openExternalLink(event, CREATOR_URL)
