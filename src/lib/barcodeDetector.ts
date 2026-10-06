// Lector de códigos de barras para el escáner de productos.
//
// La Barcode Detection API del navegador solo existe en Chrome para Android (y algún escritorio): en iPhone/Safari
// y en Firefox no hay forma de leer un código con la cámara. Para esos casos se carga, SOLO cuando hace falta, una
// implementación en WebAssembly (barcode-detector + zxing-wasm, ~1 MB) servida desde la propia web, no desde un CDN.

export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

export interface DetectedCode { rawValue: string }
export interface DetectorLike {
  detect(source: CanvasImageSource | ImageBitmap | ImageData | Blob): Promise<DetectedCode[]>
  /** true si es el nativo del navegador (rápido); false si es la versión WebAssembly (conviene no leer en cada fotograma). */
  native: boolean
}

/** ¿Se puede abrir la cámara? (necesita HTTPS o localhost y permiso del usuario) */
export function canUseCamera(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

let wasmReady: Promise<void> | null = null

export async function createBarcodeDetector(): Promise<DetectorLike> {
  const NativeDetector = typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined
  if (NativeDetector) {
    const d = new NativeDetector({ formats: SCAN_FORMATS })
    return { native: true, detect: (src) => d.detect(src) }
  }
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
  if (!wasmReady) {
    // El .wasm lo empaqueta Vite junto al resto de la web (URL con hash), no se baja de ningún CDN.
    const wasmUrl = new URL('../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url).href
    wasmReady = prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    }).then(() => undefined).catch(e => { wasmReady = null; throw e })
  }
  await wasmReady
  const d = new BarcodeDetector({ formats: SCAN_FORMATS as any })
  return { native: false, detect: (src) => d.detect(src as any) }
}
