// Sin imports: lo usa la función delete-client (Deno) y lo prueba vitest.

/** Buckets que guardan ficheros de un cliente concreto (los demás son del nutricionista). */
export const CLIENT_FILE_BUCKETS = ["photos", "lab-reports"] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v)
}

/**
 * Ruta de un objeto dentro de su bucket a partir de lo que haya guardado una
 * fila: hoy es la ruta a secas (`<clienteId>/meals/123.jpg`), pero filas
 * antiguas pueden tener la URL pública o firmada completa. Devuelve null si el
 * valor no apunta a ese bucket (o está vacío).
 */
export function storagePathFromValue(value: unknown, bucket: string): string | null {
  if (typeof value !== "string" || value.trim() === "") return null
  const v = value.trim()
  if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, "")
  const m = v.match(new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

/** Quita nulos y repetidos. */
export function uniquePaths(paths: (string | null | undefined)[]): string[] {
  return [...new Set(paths.filter((p): p is string => !!p))]
}

/**
 * Solo las rutas que cuelgan de la carpeta indicada. Las filas de un cliente
 * guardan rutas que él mismo puede escribir, así que una podría apuntar a un
 * fichero de OTRO cliente: sin este filtro, eliminar a uno borraría archivos
 * del otro. También descarta cualquier ruta con '..'.
 */
export function onlyUnderFolder(paths: string[], folder: string): string[] {
  return paths.filter(p => p.startsWith(`${folder}/`) && !p.split('/').includes('..'))
}

export interface StorageEntry { name: string; id: string | null }

/**
 * Todos los ficheros bajo una carpeta, recorriendo subcarpetas (en el almacenamiento
 * las carpetas salen con id nulo) y paginando. `list` es la llamada al
 * almacenamiento: así se puede probar con uno falso.
 */
export async function listFilesRecursive(
  list: (prefix: string, offset: number, limit: number) => Promise<StorageEntry[]>,
  prefix: string,
  pageSize = 1000,
): Promise<string[]> {
  const files: string[] = []
  for (let offset = 0; ; offset += pageSize) {
    const entries = await list(prefix, offset, pageSize)
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`
      if (entry.id === null) files.push(...await listFilesRecursive(list, path, pageSize))
      else files.push(path)
    }
    if (entries.length < pageSize) break
  }
  return files
}

/** Trocea una lista para las llamadas de borrado del almacenamiento. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
