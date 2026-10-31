import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraOff, Flashlight, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '../ui/Button'

const isNative = Capacitor.isNativePlatform()

export const TripQrScanner = ({ onCode, onClose }) => {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const handledRef = useRef(false)
  const cameraSessionRef = useRef(0)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState([])
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [torch, setTorch] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  const stop = useCallback(() => {
    cameraSessionRef.current += 1
    controlsRef.current?.stop?.()
    controlsRef.current = null
    const stream = videoRef.current?.srcObject
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setActive(false)
    setTorch(false)
    setTorchAvailable(false)
  }, [])

  const onDetected = useCallback((value) => {
    if (!value || handledRef.current) return
    handledRef.current = true
    stop()
    onCode(value)
  }, [onCode, stop])

  const startCamera = useCallback(async (requestedDeviceIndex = deviceIndex) => {
    const cameraSession = cameraSessionRef.current + 1
    cameraSessionRef.current = cameraSession
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera scanning is unavailable in this browser. Open Contri over HTTPS or enter the invitation code manually.')
      return
    }
    if (!window.isSecureContext) {
      setError('Camera access requires a secure connection. Open the HTTPS Contri website or enter the invitation code manually.')
      return
    }

    let permissionStream
    try {
      handledRef.current = false

      // Request permission before enumerating so Android WebView and browsers
      // reveal camera labels/devices and show the platform permission prompt.
      permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      if (cameraSession !== cameraSessionRef.current) {
        permissionStream.getTracks().forEach((track) => track.stop())
        return
      }
      permissionStream.getTracks().forEach((track) => track.stop())
      permissionStream = null

      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (cameraSession !== cameraSessionRef.current) return
      const cameras = await BrowserQRCodeReader.listVideoInputDevices()
      if (cameraSession !== cameraSessionRef.current) return
      if (!cameras.length) {
        setError('No camera was found on this device. Enter the invitation code instead.')
        return
      }

      setDevices(cameras)
      const rearIndex = cameras.findIndex((camera) => /back|rear|environment/i.test(camera.label))
      const selectedIndex = requestedDeviceIndex === 0 && rearIndex >= 0
        ? rearIndex
        : Math.min(requestedDeviceIndex, cameras.length - 1)
      setDeviceIndex(selectedIndex)

      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromVideoDevice(
        cameras[selectedIndex].deviceId,
        videoRef.current,
        (result) => {
          const value = result?.getText()
          if (value) onDetected(value)
        },
      )
      if (cameraSession !== cameraSessionRef.current) {
        controls.stop()
        videoRef.current?.srcObject?.getTracks?.().forEach((track) => track.stop())
        return
      }
      controlsRef.current = controls
      setActive(true)
      setTorchAvailable(typeof controls.switchTorch === 'function')
    } catch (scanError) {
      permissionStream?.getTracks().forEach((track) => track.stop())
      if (cameraSession !== cameraSessionRef.current) return
      const message = scanError?.name === 'NotAllowedError' || scanError?.name === 'PermissionDeniedError'
        ? isNative
          ? 'Camera permission was denied. Allow Camera in Android Settings > Apps > Contri > Permissions, or enter the code manually.'
          : 'Camera permission was denied. Allow camera access in your browser site settings, or enter the code manually.'
        : scanError?.name === 'NotFoundError'
          ? 'No camera was found on this device. Enter the invitation code instead.'
          : scanError?.name === 'NotReadableError'
            ? 'The camera is busy or unavailable. Close other camera apps and try again.'
            : 'The camera could not start. Check camera permission and try again, or enter the code manually.'
      setError(message)
    }
  }, [deviceIndex, onDetected])

  const start = async () => {
    if (starting || active) return
    setStarting(true)
    setError('')
    try {
      await startCamera()
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (!isNative) return () => document.removeEventListener('visibilitychange', onVisibilityChange)

    let disposed = false
    let backSubscription
    let stateSubscription
    App.addListener('backButton', () => {
      stop()
      onClose()
    }).then((subscription) => {
      if (disposed) subscription.remove()
      else backSubscription = subscription
    })
    App.addListener('appStateChange', ({ isActive: appIsActive }) => {
      if (!appIsActive) stop()
    }).then((subscription) => {
      if (disposed) subscription.remove()
      else stateSubscription = subscription
    })
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      backSubscription?.remove()
      stateSubscription?.remove()
    }
  }, [onClose, stop])

  useEffect(() => () => stop(), [stop])

  const switchCamera = async () => {
    if (devices.length < 2) return
    const nextIndex = (deviceIndex + 1) % devices.length
    stop()
    setError('')
    await startCamera(nextIndex)
  }

  const toggleTorch = async () => {
    try {
      await controlsRef.current?.switchTorch?.(!torch)
      setTorch(!torch)
    } catch {
      setError('Torch control is not available on this camera.')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex min-h-dvh flex-col bg-black text-white">
      <video aria-label="Live camera preview" autoPlay className="absolute inset-0 h-full w-full object-cover" muted playsInline ref={videoRef} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col bg-black/45 px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <button aria-label="Close QR scanner" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" onClick={() => { stop(); onClose() }} type="button"><X className="h-5 w-5" /></button>
          <p className="font-display text-base font-semibold">Scan trip QR</p>
          <div className="flex items-center gap-2">
            <button aria-label={torch ? 'Turn torch off' : 'Turn torch on'} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-40" disabled={!active || !torchAvailable} onClick={toggleTorch} type="button"><Flashlight className={`h-5 w-5 ${torch ? 'text-amber-300' : ''}`} /></button>
            <button aria-label="Switch camera" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-40" disabled={!active || devices.length < 2} onClick={switchCamera} type="button"><RefreshCw className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="mb-6 max-w-xs text-sm text-white/80">Position the trip QR code inside the frame.</p>
          <div className="relative aspect-square w-[min(72vw,20rem)] max-h-[42dvh] rounded-[2rem] border border-white/10 bg-transparent">
            <span className="scanner-corner left-0 top-0" /><span className="scanner-corner right-0 top-0 rotate-90" />
            <span className="scanner-corner bottom-0 right-0 rotate-180" /><span className="scanner-corner bottom-0 left-0 -rotate-90" />
            {active ? <span aria-hidden="true" className="scanner-line" /> : <div className="absolute inset-0 flex items-center justify-center text-white/65"><CameraOff className="h-8 w-8" /></div>}
          </div>
          {!active ? <Button className="mt-7 min-h-12" loading={starting} onClick={start} type="button"><Camera className="h-4 w-4" /> Start camera</Button> : <p aria-live="polite" className="mt-6 text-sm text-white/70">Camera is active. Hold steady while Contri reads the code.</p>}
          {error ? <p className="mt-4 max-w-sm rounded-xl bg-white/10 p-3 text-sm text-white" role="alert">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
