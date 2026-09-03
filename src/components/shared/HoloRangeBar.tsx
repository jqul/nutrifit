import { BloodMarkerDef, evaluateMarker, MarkerStatus } from '../../lib/bloodMarkers'
import { ArrowDown, ArrowUp } from 'lucide-react'

const STATUS_LABEL: Record<MarkerStatus, string> = { bajo: 'Bajo', normal: 'Óptimo', alto: 'Alto' }
const STATUS_CLASS: Record<MarkerStatus, string> = {
  bajo: 'bg-warn/10 text-warn', alto: 'bg-warn/10 text-warn', normal: 'bg-ok/10 text-ok',
}

function clampPct(value: number, min: number, max: number): number {
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

/**
 * Medidor clínico de 3 zonas calibrado sobre el rango real del marcador —
 * baja (roja/ámbar si salirse de ahí importa clínicamente), óptima (verde
 * esmeralda) y alta (ídem) — con el valor actual como marca sólida y, si
 * hay una extracción anterior, una marca translúcida + la variación.
 */
export function HoloRangeBar({ def, value, previousValue }: {
  def: BloodMarkerDef
  value: number
  previousValue?: number | null
}) {
  const status = evaluateMarker(def, value)
  const { scaleMin, scaleMax, min, max } = def

  const lowZoneEnd = clampPct(min, scaleMin, scaleMax)
  const highZoneStart = clampPct(max, scaleMin, scaleMax)
  const valuePct = clampPct(value, scaleMin, scaleMax)
  const prevPct = previousValue != null ? clampPct(previousValue, scaleMin, scaleMax) : null

  // Una zona fuera de rango solo se pinta como "atención" si de verdad hay
  // un consejo asociado a ese lado — para el HDL, por ejemplo, "alto" no
  // tiene highAdvice porque no es un problema, así que esa zona se deja
  // neutra en vez de sugerir un aviso que no existe.
  const lowZoneWarn = def.lowAdvice !== ''
  const highZoneWarn = def.highAdvice !== ''

  const delta = previousValue != null ? Math.round((value - previousValue) * 100) / 100 : null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{def.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {delta != null && delta !== 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${delta > 0 ? 'text-muted' : 'text-muted'}`} title="vs. extracción anterior">
              {delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
              {Math.abs(delta)} {def.unit}
            </span>
          )}
          <span className="text-sm font-bold tabular-nums">{value} <span className="text-xs font-normal text-muted">{def.unit}</span></span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full overflow-hidden bg-bg-alt">
        {lowZoneEnd > 0 && (
          <div className="absolute inset-y-0 left-0" style={{ width: `${lowZoneEnd}%` }}>
            <div className={`w-full h-full ${lowZoneWarn ? 'bg-warn/25' : 'bg-muted/15'}`} />
          </div>
        )}
        <div className="absolute inset-y-0 bg-ok/30" style={{ left: `${lowZoneEnd}%`, width: `${Math.max(0, highZoneStart - lowZoneEnd)}%` }} />
        {highZoneStart < 100 && (
          <div className="absolute inset-y-0" style={{ left: `${highZoneStart}%`, width: `${100 - highZoneStart}%` }}>
            <div className={`w-full h-full ${highZoneWarn ? 'bg-warn/25' : 'bg-muted/15'}`} />
          </div>
        )}

        {prevPct != null && (
          <div className="absolute inset-y-0 w-0.5 bg-ink/25" style={{ left: `${prevPct}%` }} title={`Anterior: ${previousValue} ${def.unit}`} />
        )}
        <div className={`absolute inset-y-[-2px] w-1 rounded-full ${status === 'normal' ? 'bg-ok' : 'bg-warn'}`}
          style={{ left: `${valuePct}%`, transform: 'translateX(-50%)' }} title={`${value} ${def.unit}`} />
      </div>

      <div className="flex justify-between text-[9px] text-muted tabular-nums">
        <span>{scaleMin}</span>
        <span className="text-ok/80">{min}–{max} óptimo</span>
        <span>{scaleMax}+</span>
      </div>
    </div>
  )
}
