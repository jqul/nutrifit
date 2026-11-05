import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { describeAccessSummary } from '../../lib/accessLog'

/** «Quién ha visto mis datos»: un resumen de los accesos de su nutricionista a su ficha en el último año (sin el detalle). */
export function AccessSummaryCard({ clientId, nutricionistaName, demoMode }: { clientId: string; nutricionistaName: string; demoMode?: boolean }) {
  const [summary, setSummary] = useState<{ opens: number; exports: number; last_at: string | null } | null>(
    demoMode ? { opens: 9, exports: 1, last_at: new Date(Date.now() - 86400000).toISOString() } : null)

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    supabase.rpc('get_my_access_summary', { p_client_id: clientId }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data
      if (!cancelled && row) setSummary({ opens: Number(row.opens) || 0, exports: Number(row.exports) || 0, last_at: row.last_at ?? null })
    })
    return () => { cancelled = true }
  }, [clientId, demoMode])

  if (!summary) return null
  return (
    <div className="card p-5 space-y-1.5">
      <p className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-ok" /> Quién ha visto tus datos</p>
      <p className="text-sm text-muted leading-relaxed">{describeAccessSummary(summary, nutricionistaName)}</p>
      <p className="text-xs text-muted">Cuenta lo que se hace dentro de la aplicación. Si quieres saber más o ejercer tus derechos sobre tus datos, díselo a tu nutricionista.</p>
    </div>
  )
}
