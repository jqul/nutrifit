import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

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
  minScale: customMin, maxScale: customMax, description, dietaryNote,
}: HoloRangeBarProps) {
  const [showAdvice, setShowAdvice] = useState(false)

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

  return (
    <div className="p-4 rounded-xl border border-border bg-card shadow-xs transition-all hover:border-accent/40">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-ink">{name}</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isOptimal ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : isLow ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}>
              {isOptimal ? 'Óptimo' : isLow ? 'Bajo' : 'Elevado'}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{description || `Rango óptimo: ${minNormal} – ${maxNormal} ${unit}`}</p>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex items-baseline justify-end gap-1">
            <span className={`text-xl font-bold tracking-tight ${statusColor}`}>{value}</span>
            <span className="text-xs font-medium text-muted">{unit}</span>
          </div>
          {delta !== null && delta !== 0 && (
            <p className={`text-[11px] font-medium ${deltaClass}`}>
              vs anterior: {delta > 0 ? `+${delta}` : delta} {unit}
              {deltaPct != null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
            </p>
          )}
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-border/60 overflow-hidden my-3">
        <div className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-500/40"
          style={{ left: `${normalLeft}%`, width: `${normalWidth}%` }} />
        {previousPos !== undefined && (
          <div className="absolute top-0 bottom-0 w-1 bg-muted/60 z-0" style={{ left: `${previousPos}%` }}
            title={`Valor previo: ${previousValue} ${unit}`} />
        )}
        <div className={`absolute top-0 bottom-0 w-2.5 -ml-1 rounded-full shadow-xs z-10 transition-all ${
          isOptimal ? 'bg-emerald-500' : isLow ? 'bg-amber-500' : 'bg-rose-500'
        }`} style={{ left: `${currentPos}%` }} />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" /> &lt; {minNormal}</span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
          {/* Un max "centinela" (ej. HDL: 999, porque un HDL alto nunca es
              un problema) no es un límite real que enseñar en la etiqueta. */}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Óptimo: {maxNormal > 500 ? `≥ ${minNormal}` : `${minNormal} – ${maxNormal}`}
        </span>
        {maxNormal <= 500 && (
          <span className="flex items-center gap-1">&gt; {maxNormal} <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60" /></span>
        )}
      </div>

      {dietaryNote && (
        <div className="mt-2.5 pt-2.5 border-t border-border/60">
          <button onClick={() => setShowAdvice(v => !v)} className="w-full flex items-center justify-between gap-2 text-xs text-muted hover:text-accent transition-colors">
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 flex-shrink-0" /> Estrategia nutricional personalizada</span>
            <span className="flex items-center gap-0.5 font-semibold text-accent flex-shrink-0">
              Ver pauta {showAdvice ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </button>
          {showAdvice && (
            <p className="text-xs text-muted bg-bg-alt/60 p-2.5 rounded-lg mt-2 border border-border/40">{dietaryNote}</p>
          )}
        </div>
      )}
    </div>
  )
}
