import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { toast } from './Toast'
import { lookupBarcode, ScannedFood } from '../../lib/openFoodFacts'
import { Barcode, Search } from 'lucide-react'

// La Barcode Detection API solo existe en navegadores basados en Chromium
// (Chrome/Edge/Android). En el resto (Firefox, Safari) se usa el campo manual.
declare global {
  interface Window { BarcodeDetector?: any }
}

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
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!open || !supported) return
    let cancelled = false
    let raf = 0

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }

        const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        const tick = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) { await handleCode(codes[0].rawValue); return }
          } catch { /* frame no listo aún, seguir intentando */ }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
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

  const handleCode = async (code: string) => {
    setLoading(true)
    const food = await lookupBarcode(code)
    setLoading(false)
    if (!food) { toast(`Producto no encontrado (código ${code})`, 'warn'); return }
    onFound(food)
  }

  return (
    <Modal open={open} onClose={onClose} title="Escanear código de barras">
      <div className="space-y-4">
        {supported && !cameraError ? (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm">Buscando producto...</div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">
            {supported ? 'No se pudo acceder a la cámara.' : 'Tu navegador no soporta el escaneo por cámara.'} Escribe el código de barras a mano:
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
        <p className="text-[11px] text-muted">Datos nutricionales de OpenFoodFacts (base de datos pública y colaborativa).</p>
      </div>
    </Modal>
  )
}
