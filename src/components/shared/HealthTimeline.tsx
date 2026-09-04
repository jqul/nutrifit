import { useState } from 'react'
import { WeightEntry, ProgressPhotoSession, MealLog, DailyCheckin, ClinicalNote } from '../../types'
import { BloodMarkerRow } from '../../lib/supabase-types'
import {
  buildHealthTimeline, groupTimelineByMonth, TimelineEvent, TimelineEventType,
  AnaliticaEvent, PesoEvent, FotoEvent, NotaEvent, ComidaEvent, HitoEvent,
} from '../../lib/healthTimeline'
import { calcAdherence } from '../../lib/adherence'
import { Activity, Scale, Camera, FileText, UtensilsCrossed, Flame, X, History, Sparkles, ChevronDown } from 'lucide-react'

const FILTERS: { key: TimelineEventType | 'all'; label: string; emoji?: string }[] = [
  { key: 'all', label: 'Todo el feed' },
  { key: 'analitica', label: 'Analíticas', emoji: '🔬' },
  { key: 'peso', label: 'Peso', emoji: '⚖️' },
  { key: 'foto', label: 'Fotos', emoji: '📸' },
  { key: 'nota', label: 'Notas clínicas', emoji: '📝' },
  { key: 'comida', label: 'Comidas', emoji: '🍽️' },
]

const TYPE_ACCENT: Record<Exclude<TimelineEventType, 'hito'>, { circle: string; label: string; text: string }> = {
  analitica: { circle: 'bg-rose-500', label: 'text-rose-600 dark:text-rose-400', text: 'Analítica de sangre' },
  peso: { circle: 'bg-blue-500', label: 'text-blue-600 dark:text-blue-400', text: 'Pesaje registrado' },
  foto: { circle: 'bg-purple-500', label: 'text-purple-600 dark:text-purple-400', text: 'Sesión de fotos' },
  nota: { circle: 'bg-amber-500', label: 'text-amber-600 dark:text-amber-400', text: 'Nota clínica' },
  comida: { circle: 'bg-emerald-500', label: 'text-emerald-600 dark:text-emerald-400', text: 'Diario de comidas' },
}

const TYPE_ICON = { analitica: Activity, peso: Scale, foto: Camera, nota: FileText, comida: UtensilsCrossed }

function fmtDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Health Timeline: unifica en un eje vertical todos los eventos de salud
 * del cliente (analíticas, pesajes, fotos, notas del profesional, comidas
 * del diario e hitos de racha) agrupados por mes, con filtro táctil por
 * tipo de evento. Se usa tal cual tanto en SeguimientoTab (nutricionista)
 * como en ProgresoClienteTab (cliente) — "variant" solo ajusta el texto.
 */
export function HealthTimeline({
  weights, bloodMarkers, photos, clinicalNotes, mealLogs, checkins, variant = 'client',
  nutricionistaName, goalWeightKg,
}: {
  weights: WeightEntry[]
  bloodMarkers: BloodMarkerRow[]
  photos: ProgressPhotoSession[]
  clinicalNotes: ClinicalNote[]
  mealLogs: MealLog[]
  checkins: DailyCheckin[]
  variant?: 'trainer' | 'client'
  nutricionistaName?: string
  goalWeightKg?: number | null
}) {
  const [filter, setFilter] = useState<TimelineEventType | 'all'>('all')
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)

  const allEvents = buildHealthTimeline({ weights, bloodMarkers, photos, clinicalNotes, mealLogs, checkins })
  const filtered = filter === 'all' ? allEvents : allEvents.filter(e => e.type === filter)
  const groups = groupTimelineByMonth(filtered)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <div>
        <p className="font-serif font-bold text-lg flex items-center gap-2">
          <History className="w-4 h-4 text-accent" /> Health Timeline
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent/10 text-accent">Estilo Holo</span>
        </p>
        <p className="text-xs text-muted mt-0.5">Línea cronológica unificada de hitos clínicos, biomarcadores, peso, fotos y notas.</p>
      </div>

      {allEvents.length === 0 ? (
        <p className="text-sm text-muted">{variant === 'trainer' ? 'Todavía no hay eventos registrados para este cliente.' : 'Todavía no tienes eventos registrados — tu progreso irá apareciendo aquí.'}</p>
      ) : (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f.key ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
                }`}>
                {f.label}{f.emoji ? ` ${f.emoji}` : ''}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted">Sin eventos de este tipo todavía.</p>
          ) : (
            <div className="space-y-6">
              {groups.map(group => (
                <div key={group.key}>
                  <span className="inline-block px-3 py-1 rounded-full bg-bg-alt text-xs font-semibold text-muted mb-3">{group.label}</span>
                  <div className="space-y-3">
                    {group.events.map(e => (
                      <TimelineEventCard key={e.id} event={e} checkins={checkins} goalWeightKg={goalWeightKg}
                        nutricionistaName={nutricionistaName || 'Tu nutricionista'}
                        onOpenPhoto={(url, label) => setLightbox({ url, label })} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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

function TimelineEventCard({ event, checkins, goalWeightKg, nutricionistaName, onOpenPhoto }: {
  event: TimelineEvent
  checkins: DailyCheckin[]
  goalWeightKg?: number | null
  nutricionistaName: string
  onOpenPhoto: (url: string, label: string) => void
}) {
  if (event.type === 'hito') return <HitoCard event={event} checkins={checkins} />

  const accent = TYPE_ACCENT[event.type]
  const Icon = TYPE_ICON[event.type]

  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full ${accent.circle} text-white flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${accent.label}`}>{accent.text} · {fmtDate(event.date)}</p>
          {event.type === 'nota' && <span className="text-[10px] text-muted flex-shrink-0">Por {nutricionistaName}</span>}
        </div>

        {event.type === 'analitica' && <AnaliticaCardBody event={event} />}
        {event.type === 'peso' && <PesoCardBody event={event} goalWeightKg={goalWeightKg} />}
        {event.type === 'foto' && <FotoCardBody event={event} onOpenPhoto={onOpenPhoto} />}
        {event.type === 'nota' && <NotaCardBody event={event} />}
        {event.type === 'comida' && <ComidaCardBody event={event} />}
      </div>
    </div>
  )
}

function AnaliticaCardBody({ event }: { event: AnaliticaEvent }) {
  const [expanded, setExpanded] = useState(false)
  const outOfRange = event.markers.filter(m => m.status !== 'normal').length
  const shown = expanded ? event.markers : event.markers.slice(0, 6)
  const hiddenCount = event.markers.length - shown.length

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm">Extracción clínica ({event.markers.length} biomarcador{event.markers.length > 1 ? 'es' : ''} analizados)</p>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 whitespace-nowrap ${outOfRange > 0 ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'}`}>
          {outOfRange > 0 ? `⚠ ${outOfRange} fuera de rango` : '✓ Todo en rango'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(m => (
          <span key={m.def.key} className={`px-2 py-1 rounded-lg text-xs font-medium ${m.status === 'normal' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>
            {m.def.label}: {m.value} {m.def.unit}
          </span>
        ))}
        {hiddenCount > 0 && (
          <button onClick={() => setExpanded(true)} className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10">
            +{hiddenCount} más <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function PesoCardBody({ event, goalWeightKg }: { event: PesoEvent; goalWeightKg?: number | null }) {
  let deltaClass = 'bg-bg-alt text-muted'
  if (event.deltaKg != null && event.deltaKg !== 0) {
    if (goalWeightKg != null) {
      const prevWeight = event.weightKg - event.deltaKg
      const improving = Math.abs(event.weightKg - goalWeightKg) < Math.abs(prevWeight - goalWeightKg)
      deltaClass = improving ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
    }
  }
  const distance = goalWeightKg != null ? Math.round(Math.abs(event.weightKg - goalWeightKg) * 10) / 10 : null

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-serif font-bold">{event.weightKg} kg</span>
        {event.deltaKg != null && event.deltaKg !== 0 && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${deltaClass}`}>
            {event.deltaKg > 0 ? '↗' : '↘'} {event.deltaKg > 0 ? '+' : ''}{event.deltaKg} kg vs anterior
          </span>
        )}
      </div>
      {goalWeightKg != null && (
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-muted uppercase tracking-wide">Meta: {goalWeightKg} kg</p>
          <p className="text-xs font-semibold text-ok">{distance === 0 ? '¡Objetivo alcanzado! 🎉' : `A ${distance} kg de la meta`}</p>
        </div>
      )}
    </div>
  )
}

function FotoCardBody({ event, onOpenPhoto }: { event: FotoEvent; onOpenPhoto: (url: string, label: string) => void }) {
  return (
    <div>
      <p className="font-semibold text-sm mb-2">Sesión de fotos{event.session.note ? ` — ${event.session.note}` : ''}</p>
      <div className="grid grid-cols-3 gap-1.5 max-w-[240px]">
        {([['front', event.session.frontUrl, 'Frontal'], ['side', event.session.sideUrl, 'Perfil'], ['back', event.session.backUrl, 'Espalda']] as const).map(([key, url, label]) => (
          <button key={key} disabled={!url} onClick={() => url && onOpenPhoto(url, label)}
            className="aspect-square bg-bg-alt rounded-lg overflow-hidden flex items-center justify-center disabled:cursor-default">
            {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <span className="text-[9px] text-muted">—</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function NotaCardBody({ event }: { event: NotaEvent }) {
  return <p className="text-sm text-ink/90 leading-relaxed">{event.note}</p>
}

function ComidaCardBody({ event }: { event: ComidaEvent }) {
  return (
    <div className="flex items-center gap-3">
      {event.photoUrl ? (
        <img src={event.photoUrl} alt={event.mealName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-bg-alt flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed className="w-5 h-5 text-muted" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-sm">{event.mealName}</p>
        {event.note && <p className="text-xs text-muted mt-0.5">{event.note}</p>}
      </div>
    </div>
  )
}

function HitoCard({ event, checkins }: { event: HitoEvent; checkins: DailyCheckin[] }) {
  const pct = calcAdherence(checkins, 7, new Date(event.date + 'T00:00:00'))
  const rating = pct >= 90 ? 'Excelente' : pct >= 75 ? 'Buena' : 'Regular'

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
        <Flame className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Hito de adherencia</p>
          <p className="font-semibold text-sm">{event.label}</p>
          <p className="text-xs text-muted mt-0.5">Adherencia al plan de nutrición y check-ins registrada en el {pct}%.</p>
        </div>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5" /> {rating}
        </span>
      </div>
    </div>
  )
}
