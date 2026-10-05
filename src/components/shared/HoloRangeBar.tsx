import { useState, ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface HoloRangeBarProps {
  name: string
  unit: string
  value: number
  previousValue?: number | null
  minNormal: number
  maxNormal: number
  minScale?: number
  maxScale?: number
  description?: string
  dietaryNote?: string
  /** Contenido extra del desplegable de detalles (p. ej. el historial del marcador). */
  children?: ReactNode
}

function distanceFromRange(v: number, min: number, max: number): number {
  if (v < min) return min - v
  if (v > max) return v - max
  return 0
}

/**
 * Medidor clínico de 3 zonas calibrado sobre el rango real del marcador —
 * baja/óptima (verde esmeralda)/alta, con el valor actual como cabezal
 * sólido y, si hay una extracción anterior, una marca translúcida + la
 * variación (absoluta y en %). El color de la variación no sigue el signo
 * bruto sino si el valor se ha acercado o alejado del rango óptimo — para
 * HDL o vitamina D, subir es una mejora, no un empeoramiento.
 */
export function HoloRangeBar({
  name, unit, value, previousValue, minNormal, maxNormal,
  minScale: customMin, maxScale: customMax, description, dietaryNote, children,
}: HoloRangeBarProps) {
  const [showDetails, setShowDetails] = useState(false)

  const span = maxNormal - minNormal
  const minScale = customMin ?? Math.max(0, Math.floor(minNormal - span * 0.75))
  const maxScale = customMax ?? Math.ceil(maxNormal + span * 0.75)
  const totalScale = maxScale - minScale || 1

  const clamp = (v: number) => Math.min(100, Math.max(0, ((v - minScale) / totalScale) * 100))
  const currentPos = clamp(value)
  const previousPos = previousValue != null ? clamp(previousValue) : undefined
  const normalLeft = clamp(minNormal)
  const normalRight = clamp(maxNormal)
  const normalWidth = Math.max(2, normalRight - normalLeft)

  const isLow = value < minNormal
  const isHigh = value > maxNormal
  const isOptimal = !isLow && !isHigh

  const statusColor = isOptimal
    ? 'text-emerald-500 dark:text-emerald-400'
    : isLow ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'

  const delta = previousValue != null ? Math.round((value - previousValue) * 100) / 100 : null
  const deltaPct = previousValue != null && previousValue !== 0 ? ((value - previousValue) / previousValue) * 100 : null

  const deltaImproving = previousValue != null
    ? distanceFromRange(value, minNormal, maxNormal) < distanceFromRange(previousValue, minNormal, maxNormal)
    : false
  const deltaWorsening = previousValue != null
    ? distanceFromRange(value, minNormal, maxNormal) > distanceFromRange(previousValue, minNormal, maxNormal)
    : false
  const deltaClass = deltaImproving ? 'text-emerald-500' : deltaWorsening ? 'text-rose-500' : 'text-muted'

  const optimalLabel = maxNormal > 500 ? `≥ ${minNormal}` : `${minNormal} – ${maxNormal}`

  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm text-ink">{name}</h4>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            isOptimal ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : isLow ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}>
            {isOptimal ? 'Óptimo' : isLow ? 'Bajo' : 'Elevado'}
          </span>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex items-baseline justify-end gap-1">
            <span className={`text-2xl font-serif font-bold tracking-tight ${statusColor}`}>{value}</span>
            <span className="text-xs font-medium text-muted">{unit}</span>
          </div>
          {previousValue != null && (
            <p className={`text-xs ${delta ? deltaClass : 'text-muted'}`}>
              anterior {previousValue}{delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-border/60 overflow-hidden mt-3">
        <div className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-500/40"
          style={{ left: `${normalLeft}%`, width: `${normalWidth}%` }} />
        {previousPos !== undefined && (
          <div className="absolute top-0 bottom-0 w-1 bg-muted/60 z-0" style={{ left: `${previousPos}%` }}
            title={`Valor previo: ${previousValue} ${unit}`} />
        )}
        <div className={`absolute top-0 bottom-0 w-2.5 -ml-1 rounded-full z-10 transition-all ${
          isOptimal ? 'bg-emerald-500' : isLow ? 'bg-amber-500' : 'bg-rose-500'
        }`} style={{ left: `${currentPos}%` }} />
      </div>

      <button onClick={() => setShowDetails(v => !v)} aria-expanded={showDetails}
        className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent transition-colors">
        {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Detalles
      </button>
      {showDetails && (
        <div className="mt-2 space-y-3 text-xs text-muted">
          <p>
            <span className="font-semibold text-ink">Rango óptimo:</span> {optimalLabel} {unit}
            {delta !== null && delta !== 0 && deltaPct != null && <> · <span className="font-semibold text-ink">Variación:</span> {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% vs anterior</>}
          </p>
          {description && <p>{description}</p>}
          {dietaryNote && (
            <div className="bg-bg-alt/60 p-2.5 rounded-lg border border-border/40">
              <p className="font-semibold text-ink mb-0.5">Pauta nutricional</p>
              <p>{dietaryNote}</p>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
