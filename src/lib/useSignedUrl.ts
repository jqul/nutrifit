import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { extractObjectPath } from './storagePath'

const DEFAULT_TTL_SECONDS = 3600

/** Quita un "?v=..." final (cache-bust de versiones antiguas del valor). */
function stripQuery(value: string): string {
  const i = value.indexOf('?')
  return i === -1 ? value : value.slice(0, i)
}

/**
 * Para ficheros de un bucket privado: recibe lo que haya guardado en la base
 * de datos (la ruta del objeto, o la URL pública antigua) y devuelve una URL
 * firmada de corta duración, o null mientras se calcula / si falla.
 */
export function useSignedUrl(bucket: string, value: string | null | undefined, expiresIn = DEFAULT_TTL_SECONDS): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!value) { setUrl(null); return }
    const clean = stripQuery(value)
    const objectPath = clean.startsWith('http') ? extractObjectPath(clean, bucket) : clean
    if (!objectPath) { setUrl(null); return }

    let cancelled = false
    supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn).then(({ data, error }) => {
      if (!cancelled) setUrl(error ? null : (data?.signedUrl ?? null))
    })
    return () => { cancelled = true }
  }, [bucket, value, expiresIn])

  return url
}
