// Lectura paginada de Supabase. PostgREST devuelve como mucho 1.000 filas por
// consulta (valor por defecto de Supabase) y CORTA EN SILENCIO: sin paginar, una
// consulta que "trae todo" devuelve un trozo cualquiera y los cálculos salen mal
// sin ningún error. Este fichero no tiene imports: lo usan la app y, copiado por
// scripts/sync-edge-shared.mjs, las funciones programadas.

export const PAGE_SIZE = 1000
/** Cuántos ids caben en un .in(...) sin pasarse de largo en la URL. */
export const IN_CHUNK = 50

interface PageResult<T> { data: T[] | null; error: { message: string } | null }

/**
 * Pide páginas hasta que una venga incompleta. `page(from, to)` debe construir la
 * consulta con un orden ESTABLE (p. ej. .order('date').order('id')) y .range(from, to):
 * sin orden, dos páginas pueden repetir o saltarse filas.
 * Lanza el error de la base de datos en vez de devolver datos a medias.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

/** Como fetchAllRows, pero para consultas con `.in('columna', ids)`: trocea los ids y concatena. */
export async function fetchAllRowsForIds<T>(
  ids: string[],
  page: (idsChunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
  chunkSize = IN_CHUNK,
): Promise<T[]> {
  const all: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    all.push(...await fetchAllRows((from, to) => page(chunk, from, to), pageSize))
  }
  return all
}
