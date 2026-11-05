// Registro de accesos a la ficha de un cliente (0071). Se apunta lo que se hace DENTRO de la aplicación: abrir la ficha, exportar sus
// datos, sacar su informe. El acceso directo a la base de datos por otra vía no pasa por aquí.
import { supabase } from './supabase'

export type AccessAction = 'ficha' | 'exportacion' | 'informe'

export interface AccessLogRow {
  id: number
  nutricionista_id: string
  actor_id: string
  actor_name: string
  client_id: string
  action: AccessAction
  created_at: string
}

export const ACCESS_ACTION_LABEL: Record<AccessAction, string> = {
  ficha: 'Abrió la ficha',
  exportacion: 'Exportó los datos',
  informe: 'Sacó el informe',
}

/** Apunta un acceso. Nunca molesta: si falla, la app sigue como si nada (solo se pierde esa línea del registro). */
export async function logClientAccess(clientId: string, action: AccessAction): Promise<void> {
  try { await supabase.rpc('log_client_access', { p_client_id: clientId, p_action: action }) } catch { /* sin registro, pero sin ruido */ }
}

/** «5 nov, 10:42». */
export function formatAccessTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

/** «Javier · Abrió la ficha de María Torres» (o sin cliente cuando ya se está en su ficha). */
export function describeAccess(row: Pick<AccessLogRow, 'actor_name' | 'action'>, clientName?: string | null): string {
  const who = row.actor_name?.trim() || 'Alguien de tu cuenta'
  const what = ACCESS_ACTION_LABEL[row.action] ?? row.action
  return `${who} · ${what}${clientName ? ` de ${clientName}` : ''}`
}

/** El resumen que ve el cliente: una frase sin cifras confusas. */
export function describeAccessSummary(s: { opens: number; exports: number; last_at: string | null }, nutricionistaName: string): string {
  if (!s.last_at || (s.opens === 0 && s.exports === 0)) return `En el último año no hay ningún acceso registrado a tus datos desde la aplicación.`
  const parts = [
    s.opens > 0 && `${nutricionistaName} ha abierto tu ficha ${s.opens === 1 ? 'una vez' : `${s.opens} veces`}`,
    s.exports > 0 && `ha exportado tus datos ${s.exports === 1 ? 'una vez' : `${s.exports} veces`}`,
  ].filter((p): p is string => !!p)
  return `En el último año, ${parts.join(' y ')}. La última vez fue el ${new Date(s.last_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`
}
