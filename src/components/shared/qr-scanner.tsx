import jsQR from 'jsqr'
import { useEffect, useRef, useState } from 'react'

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type DetectorConstructor = new (options: { formats: string[] }) => Detector

/**
 * Reads QR codes from the back camera. Uses the browser's own BarcodeDetector where it exists (Chrome on Android),
 * and falls back to jsQR on a canvas everywhere else (iPhone Safari). The same code is never reported twice within 3 seconds.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: number | undefined
    const recent = new Map<string, number>()
    const canvas = document.createElement('canvas')
    const Native = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
    const detector = Native ? new Native({ formats: ['qr_code'] }) : null

    function report(text: string) {
      const now = Date.now()
      if (now - (recent.get(text) ?? 0) < 3000) return
      recent.set(text, now)
      onScanRef.current(text)
    }

    async function tick() {
      const el = video.current
      if (stopped || !el) return
      if (el.readyState >= 2 && el.videoWidth > 0) {
        try {
          if (detector) {
            const found = await detector.detect(el)
            if (found[0]) report(found[0].rawValue)
          } else {
            canvas.width = el.videoWidth
            canvas.height = el.videoHeight
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (context) {
              context.drawImage(el, 0, 0)
              const image = context.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(image.data, image.width, image.height)
              if (code) report(code.data)
            }
          }
        } catch {
          // A single bad frame is fine; the next one will try again.
        }
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), 150)
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (video.current) {
          video.current.srcObject = stream
          await video.current.play()
        }
        void tick()
      } catch {
        setError('We could not open the camera. Allow camera access, or tick people off from the list below.')
      }
    }
    void start()

    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (error) return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive-soft/50 px-4 py-3 text-destructive-strong">{error}</p>
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <video ref={video} muted playsInline aria-label="Camera view for scanning tickets" className="aspect-square w-full max-w-sm object-cover" />
    </div>
  )
}
