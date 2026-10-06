import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { toast } from './Toast'
import { lookupBarcodeDetailed, ScannedFood } from '../../lib/openFoodFacts'
import { canUseCamera, createBarcodeDetector } from '../../lib/barcodeDetector'
import { Barcode, Search } from 'lucide-react'

// La cámara lee el código con la Barcode Detection API del navegador si existe (Chrome en Android) y, si no
// (iPhone/Safari, Firefox), con una versión WebAssembly que se descarga solo entonces (ver barcodeDetector.ts).
// Si no hay cámara o no se da permiso, queda el campo para escribir el código a mano.
export function BarcodeScanner({ open, onClose, onFound }: {
  open: boolean
  onClose: () => void
  onFound: (food: ScannedFood) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const supported = canUseCamera()

  useEffect(() => {
    if (!open || !supported) return
    let cancelled = false
    let raf = 0

    const start = async () => {
      try {
        setCameraError(false)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }

        // La primera vez, en navegadores sin lector propio, hay que descargar el lector WebAssembly.
        setPreparing(true)
        const detector = await createBarcodeDetector()
        setPreparing(false)
        if (cancelled) return
        const tick = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              if (await handleCode(codes[0].rawValue)) return
              // No se ha podido usar ese código: antes el escáner se quedaba parado. Se espera un momento (para no
              // repetir el aviso mil veces con el mismo código delante de la cámara) y se sigue buscando.
              await new Promise(r => setTimeout(r, 2500))
              if (cancelled) return
            }
          } catch { /* frame no listo aún, seguir intentando */ }
          // El lector WebAssembly es más pesado: se lee unas 6-7 veces por segundo, no en cada fotograma.
          if (!detector.native) await new Promise(r => setTimeout(r, 150))
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setPreparing(false)
        setCameraError(true)
      }
    }
    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supported])

  /** true si se ha encontrado el producto (y ya no hace falta seguir escaneando). */
  const handleCode = async (code: string): Promise<boolean> => {
    setLoading(true)
    const r = await lookupBarcodeDetailed(code)
    setLoading(false)
    if (!r.ok) {
      toast(r.reason === 'network' ? 'No se pudo consultar OpenFoodFacts: revisa tu conexión e inténtalo de nuevo'
        : r.reason === 'no_nutrition' ? `Producto encontrado (código ${code}), pero sin datos nutricionales`
        : `Producto no encontrado (código ${code})`, 'warn')
      return false
    }
    onFound(r.food)
    return true
  }

  return (
    <Modal open={open} onClose={onClose} title="Escanear código de barras">
      <div className="space-y-4">
        {supported && !cameraError ? (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {(loading || preparing) && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm">{loading ? 'Buscando producto...' : 'Preparando la cámara...'}</div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">
            {supported ? 'No se pudo usar la cámara (¿has dado permiso?).' : 'Este navegador no deja usar la cámara.'} Escribe el código de barras a mano:
          </p>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="Código de barras (EAN)" inputMode="numeric"
              className="w-full pl-9 pr-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <button onClick={() => manualCode.trim() && handleCode(manualCode.trim())} disabled={loading || !manualCode.trim()}
            className="p-2.5 bg-ink text-white rounded-xl disabled:opacity-50">
            <Search className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted">Datos nutricionales de OpenFoodFacts (base de datos pública y colaborativa).</p>
      </div>
    </Modal>
  )
}
