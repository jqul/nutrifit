// Descarga de la copia completa de los datos de un cliente (RGPD). Lo que se
// incluye y cómo se garantiza que no falte nada está en clientExport.ts; aquí solo
// está la conexión real con Supabase y la descarga del archivo.
import { supabase } from './supabase'
import { ClientData } from '../types'
import { collectClientExport, ExportSource } from './clientExport'

// Supabase corta cada respuesta en 1.000 filas: sin paginar, un cliente con muchos
// check-ins se exportaría truncado sin ningún aviso.
const PAGE = 1000
// Los valores de un .in(...) van en la URL: se trocean para no pasarse de largo.
const IN_CHUNK = 50

const source: ExportSource = {
  async rows(table, column, values, order) {
    const all: Record<string, unknown>[] = []
    for (let i = 0; i < values.length; i += IN_CHUNK) {
      const part = values.slice(i, i + IN_CHUNK)
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from(table).select('*').in(column, part)
          .order(order, { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        all.push(...((data ?? []) as Record<string, unknown>[]))
        if (!data || data.length < PAGE) break
      }
    }
    return all
  },
  async signedUrls(bucket, paths, expiresInSeconds) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresInSeconds)
    if (error) throw new Error(`${bucket}: ${error.message}`)
    return (data ?? []).map(d => ({ path: d.path ?? '', signedUrl: d.signedUrl ?? null }))
  },
}

export async function exportClientData(client: ClientData): Promise<void> {
  const bundle = await collectClientExport(client, source)

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nutrifit-${client.name}-${client.surname}-datos.json`.replace(/\s+/g, '-').toLowerCase()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
