import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AccessLogRow, describeAccess, formatAccessTime } from '../../lib/accessLog'

const DEMO_ROWS = (clientId: string | undefined): { row: AccessLogRow; client: string }[] => {
  const mk = (id: number, action: AccessLogRow['action'], hoursAgo: number, client: string): { row: AccessLogRow; client: string } => ({
    client, row: { id, nutricionista_id: 'demo', actor_id: 'demo', actor_name: 'Alex Nutricionista', client_id: client, action, created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString() },
  })
  const all = [mk(1, 'ficha', 1, 'María Torres'), mk(2, 'informe', 26, 'María Torres'), mk(3, 'ficha', 27, 'Carlos Ruiz'), mk(4, 'exportacion', 75, 'María Torres')]
  return clientId ? all.filter(r => r.client === 'María Torres') : all
}

/**
 * Los últimos accesos a las fichas de tus clientes (o a la de uno): quién y cuándo. Es lo que se hace DENTRO de la aplicación; el
 * acceso directo a la base de datos por otra vía no se registra aquí.
 */
export function AccessLogList({ nutricionistaId, clientId, limit = 30, demoMode }: { nutricionistaId: string; clientId?: string; limit?: number; demoMode?: boolean }) {
  const [rows, setRows] = useState<{ row: AccessLogRow; client: string }[] | null>(null)

  useEffect(() => {
    if (demoMode) { setRows(DEMO_ROWS(clientId)); return }
    let cancelled = false
    ;(async () => {
      let q = supabase.from('access_log').select('*').eq('nutricionista_id', nutricionistaId).order('created_at', { ascending: false }).limit(limit)
      if (clientId) q = q.eq('client_id', clientId)
      const { data } = await q
      const list = (data || []) as AccessLogRow[]
      const ids = Array.from(new Set(list.map(r => r.client_id)))
      const names = new Map<string, string>()
      if (!clientId && ids.length > 0) {
        const { data: cl } = await supabase.from('clientes').select('id, name, surname').in('id', ids)
        for (const c of cl || []) names.set(c.id as string, `${c.name} ${c.surname}`.trim())
      }
      if (!cancelled) setRows(list.map(row => ({ row, client: names.get(row.client_id) ?? '' })))
    })()
    return () => { cancelled = true }
  }, [nutricionistaId, clientId, limit, demoMode])

  if (rows === null) return <p className="text-xs text-muted">Cargando…</p>
  if (rows.length === 0) return <p className="text-xs text-muted">Todavía no hay accesos registrados.</p>
  return (
    <ul className="divide-y divide-border/60" aria-label="Registro de accesos">
      {rows.map(({ row, client }) => (
        <li key={row.id} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
          <span className="min-w-0 truncate">{describeAccess(row, clientId ? null : client)}</span>
          <span className="text-muted flex-shrink-0">{formatAccessTime(row.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
