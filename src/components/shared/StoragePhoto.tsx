import { useState, useEffect, ImgHTMLAttributes } from 'react'
import { supabase } from '../../lib/supabase'
import { extractObjectPath } from '../../lib/storagePath'

const SIGNED_URL_TTL_SECONDS = 3600

/**
 * El bucket `photos` es privado (fotos de progreso corporal y del diario de
 * comidas — datos delicados que no deben quedar accesibles con solo
 * conocer la URL). La app guarda la RUTA del objeto, no una URL pública, y
 * este componente pide una URL firmada de corta duración (1h) justo antes
 * de mostrar la imagen.
 *
 * Filas anteriores a este cambio guardaron la URL pública completa de
 * entonces — en vez de dejarlas tal cual (lo que las mantendría públicas
 * para siempre, incluso después de hacer el bucket privado), se les
 * extrae la ruta del objeto de la propia URL (ver lib/storagePath.ts) y
 * se les pide una URL firmada igual que a las nuevas. Así el bucket puede
 * pasar a privado sin migrar datos aparte: toda foto, vieja o nueva, queda
 * protegida en cuanto se aplica la migración que cambia `public` a `false`.
 */
export function StoragePhoto({ path, bucket = 'photos', expiresIn = SIGNED_URL_TTL_SECONDS, ...imgProps }: {
  path: string | null | undefined
  bucket?: string
  expiresIn?: number
} & ImgHTMLAttributes<HTMLImageElement>) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) { setUrl(null); return }
    // Previsualizaciones locales de modo demo — nunca pasan por Storage.
    if (path.startsWith('data:') || path.startsWith('blob:')) { setUrl(path); return }

    const objectPath = path.startsWith('http') ? extractObjectPath(path, bucket) : path
    if (!objectPath) { setUrl(path); return } // URL externa que no reconocemos — mostrarla tal cual como último recurso.

    let cancelled = false
    supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn).then(({ data, error }) => {
      if (!cancelled) setUrl(error ? null : (data?.signedUrl ?? null))
    })
    return () => { cancelled = true }
  }, [path, bucket, expiresIn])

  if (!url) return null
  return <img src={url} {...imgProps} />
}
