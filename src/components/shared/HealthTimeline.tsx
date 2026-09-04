import { useState } from 'react'
import { WeightEntry, ProgressPhotoSession, MealLog, DailyCheckin, ClinicalNote } from '../../types'
import { BloodMarkerRow } from '../../lib/supabase-types'
import { buildHealthTimeline, groupTimelineByMonth, TimelineEvent, TimelineEventType } from '../../lib/healthTimeline'
import { Activity, Scale, Camera, FileText, X, History } from 'lucide-react'

const FILTERS: { key: TimelineEventType | 'all'; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'analitica', label: 'Analíticas' },
  { key: 'peso', label: 'Peso' },
  { key: 'foto', label: 'Fotos' },
  { key: 'nota', label: 'Notas clínicas' },
]

const STATUS_DOT: Record<string, string> = { bajo: 'bg-warn', alto: 'bg-warn', normal: 'bg-ok' }

function fmtDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Línea de Vida Clínica: unifica en un eje vertical todos los eventos de
 * salud del cliente (analíticas, pesajes, fotos, notas del profesional e
 * hitos de racha/diario) agrupados por mes, con filtro por tipo de evento.
 * Se usa tal cual tanto en SeguimientoTab (nutricionista) como en
 * ProgresoClienteTab (cliente) — "variant" solo ajusta el texto.
 */
export function HealthTimeline({ weights, bloodMarkers, photos, clinicalNotes, mealLogs, checkins, variant = 'client' }: {
  weights: WeightEntry[]
  bloodMarkers: BloodMarkerRow[]
  photos: ProgressPhotoSession[]
  clinicalNotes: ClinicalNote[]
  mealLogs: MealLog[]
  checkins: DailyCheckin[]
  variant?: 'trainer' | 'client'
}) {
  const [filter, setFilter] = useState<TimelineEventType | 'all'>('all')
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)

  const allEvents = buildHealthTimeline({ weights, bloodMarkers, photos, clinicalNotes, mealLogs, checkins })
  const filtered = filter === 'all' ? allEvents : allEvents.filter(e => e.type === filter)
  const groups = groupTimelineByMonth(filtered)

  if (allEvents.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-1 flex items-center gap-1.5"><History className="w-4 h-4" /> Línea de vida clínica</p>
        <p className="text-sm text-muted">{variant === 'trainer' ? 'Todavía no hay eventos registrados para este cliente.' : 'Todavía no tienes eventos registrados — tu progreso irá apareciendo aquí.'}</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <p className="font-semibold text-sm flex items-center gap-1.5"><History className="w-4 h-4" /> Línea de vida clínica</p>

      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              filter === f.key ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">Sin eventos de este tipo todavía.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2.5 sticky top-0">{group.label}</p>
              <div className="space-y-3 border-l-2 border-border pl-4 ml-1">
                {group.events.map(e => <TimelineEventCard key={e.id} event={e} onOpenPhoto={(url, label) => setLightbox({ url, label })} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightbox.url} alt={lightbox.label} className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}

function TimelineEventCard({ event, onOpenPhoto }: { event: TimelineEvent; onOpenPhoto: (url: string, label: string) => void }) {
  if (event.type === 'hito') {
    return (
      <div className="relative flex items-center gap-2 text-xs text-muted -ml-[21px] pl-[1px]">
        <span className="w-3.5 h-3.5 rounded-full bg-bg-alt border-2 border-card flex-shrink-0 flex items-center justify-center text-[9px]">{event.icon}</span>
        <span>{fmtDate(event.date)} · {event.label}</span>
      </div>
    )
  }

  return (
    <div className="relative -ml-[21px]">
      <span className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-card border-2 border-accent flex items-center justify-center">
        <TimelineIcon type={event.type} />
      </span>
      <div className="ml-6 bg-bg-alt/60 rounded-xl p-3 space-y-2">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{fmtDate(event.date)}</p>

        {event.type === 'analitica' && (
          <div className="space-y-1">
            <p className="text-sm font-semibold">Analítica de sangre — {event.markers.length} marcador{event.markers.length > 1 ? 'es' : ''}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {event.markers.map(m => (
                <span key={m.def.key} className="flex items-center gap-1 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[m.status]}`} />
                  {m.def.label}: <span className="font-semibold">{m.value} {m.def.unit}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {event.type === 'peso' && (
          <p className="text-sm">
            <span className="font-semibold">Peso: {event.weightKg} kg</span>
            {event.deltaKg != null && event.deltaKg !== 0 && (
              <span className="text-muted"> ({event.deltaKg > 0 ? '+' : ''}{event.deltaKg} kg vs. anterior)</span>
            )}
          </p>
        )}

        {event.type === 'foto' && (
          <div>
            <p className="text-sm font-semibold mb-1.5">Sesión de fotos{event.session.note ? ` — ${event.session.note}` : ''}</p>
            <div className="grid grid-cols-3 gap-1.5 max-w-[240px]">
              {([['front', event.session.frontUrl, 'Frontal'], ['side', event.session.sideUrl, 'Perfil'], ['back', event.session.backUrl, 'Espalda']] as const).map(([key, url, label]) => (
                <button key={key} disabled={!url} onClick={() => url && onOpenPhoto(url, label)}
                  className="aspect-square bg-bg-alt rounded-lg overflow-hidden flex items-center justify-center disabled:cursor-default">
                  {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <span className="text-[9px] text-muted">—</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {event.type === 'nota' && (
          <p className="text-sm italic text-ink/90">"{event.note}"</p>
        )}
      </div>
    </div>
  )
}

function TimelineIcon({ type }: { type: Exclude<TimelineEventType, 'hito'> }) {
  const cls = 'w-2 h-2 text-accent'
  if (type === 'analitica') return <Activity className={cls} />
  if (type === 'peso') return <Scale className={cls} />
  if (type === 'foto') return <Camera className={cls} />
  return <FileText className={cls} />
}
