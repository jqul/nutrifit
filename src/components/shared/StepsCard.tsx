import { useMemo } from 'react'
import { Footprints } from 'lucide-react'
import { formatSteps, hasSteps, lastDaysSeries, stepsSummary } from '../../lib/steps'
import { toLocalISODate } from '../../lib/date'

interface Day { date: string; steps?: number | null }

/**
 * Los pasos que el cliente apunta en su check-in: media de 7 y 30 días, cómo va respecto a la semana anterior y una barrita
 * por día de las dos últimas semanas. Es informativa y neutra: sin objetivo, sin colores de bien o mal, y un día sin dato
 * se queda en blanco (no cuenta como un día malo). No sale si no hay ningún dato.
 */
export function StepsCard({ checkins, title }: { checkins: Day[]; title: string }) {
  const todayISO = toLocalISODate(new Date())
  const summary = useMemo(() => stepsSummary(checkins, todayISO), [checkins, todayISO])
  const series = useMemo(() => lastDaysSeries(checkins, todayISO), [checkins, todayISO])
  if (!hasSteps(checkins)) return null

  const max = Math.max(1, ...series.map(s => s.steps ?? 0))
  const change = summary.changeVsPrevious
  const dayLabel = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Footprints className="w-4 h-4 text-muted" aria-hidden />
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-bg-alt rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-ink">{summary.last7 ? formatSteps(summary.last7.average) : '—'}</p>
          <p className="text-xs text-muted uppercase tracking-wider mt-0.5">Media 7 días</p>
          {summary.last7 && <p className="text-xs text-muted mt-0.5">{summary.last7.days} de 7 días con dato</p>}
        </div>
        <div className="bg-bg-alt rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-ink">{summary.last30 ? formatSteps(summary.last30.average) : '—'}</p>
          <p className="text-xs text-muted uppercase tracking-wider mt-0.5">Media 30 días</p>
          {summary.last30 && <p className="text-xs text-muted mt-0.5">{summary.last30.days} días con dato</p>}
        </div>
      </div>
      {change != null && Math.abs(change) >= 100 && (
        <p className="text-xs text-muted">
          {change > 0 ? '+' : '−'}{formatSteps(Math.abs(change))} pasos al día de media frente a la semana anterior.
        </p>
      )}
      <div role="img" aria-label={`Pasos de los últimos 14 días: ${series.filter(s => s.steps != null).length} días con dato`}
        className="flex items-end gap-1 h-16">
        {series.map(s => (
          <div key={s.date} className="flex-1 h-full flex items-end" title={s.steps != null ? `${dayLabel(s.date)}: ${formatSteps(s.steps)} pasos` : `${dayLabel(s.date)}: sin dato`}>
            {s.steps != null
              ? <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(6, (s.steps / max) * 100)}%` }} />
              : <div className="w-full h-1 rounded bg-bg-alt" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Los últimos 14 días. Los días en blanco son días sin apuntar.</p>
    </div>
  )
}
