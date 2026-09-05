/**
 * Extrae la ruta del objeto de una URL pública de Supabase Storage
 * (".../storage/v1/object/public/<bucket>/<ruta>") — usado para poder
 * pedir una URL firmada incluso para filas que guardaron la URL pública
 * de antes de que el bucket pasara a privado (ver StoragePhoto.tsx).
 * Devuelve null si el valor no es una URL de ese bucket.
 */
export function extractObjectPath(value: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const idx = value.indexOf(marker)
  if (idx === -1) return null
  const raw = value.slice(idx + marker.length)
  try { return decodeURIComponent(raw) } catch { return raw }
}
