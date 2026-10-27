import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

export const isValidUpiId = (value = '') =>
  /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(String(value).trim())

export const buildUpiLink = ({ upiId, name, amount, note }) => {
  const params = new URLSearchParams({
    pa: String(upiId).trim(),
    pn: name || 'Friend',
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: (note || 'Contri settlement').slice(0, 80),
  })

  return `upi://pay?${params.toString()}`
}
export const openUpiPayment = async (link) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await AppLauncher.openUrl({ url: link })
    } catch {
      toast.error('No UPI app is available on this device.')
    }
    return
  }
  window.location.href = link
}
