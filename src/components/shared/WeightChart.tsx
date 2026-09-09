import { useEffect, useRef, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts'
import { Scale, Moon } from 'lucide-react'
import { WeightEntry, CycleEntry } from '../../types'
import { movingAverage } from '../../lib/trendLine'

// Días antes de cada inicio de ciclo que cuentan como "fase lútea tardía" —
// la ventana en la que la retención de líquidos premenstrual puede sumar
// 1-2.5kg fisiológicos que no son grasa. No es una regla clínica exacta,
// solo una aproximación razonable para no confundir al cliente.
const LUTEAL_WINDOW_DAYS = 7
const LUTEAL_COLOR = '#a855f7'

/** ¿Cae esta fecha en los 7 días previos a algún inicio de ciclo? Un punto
 * de peso, no un tramo — los pesajes son esporádicos (semanales, no
 * diarios), así que sombrear un ReferenceArea entre dos categorías del eje
 * no es fiable aquí (si solo hay UN pesaje dentro de la ventana, x1 y x2
 * coinciden y recharts no dibuja nada sobre un eje de categorías). Marcar
 * el propio punto con un color distinto funciona con cualquier cantidad de
 * pesajes dentro de la ventana, incluido uno solo. */
function isInLutealWindow(dateStr: string, cycles: CycleEntry[]): boolean {
  const t = new Date(dateStr + 'T00:00:00').getTime()
  return cycles.some(c => {
    const startMs = new Date(c.startDate + 'T00:00:00').getTime()
    return t >= startMs - LUTEAL_WINDOW_DAYS * 86400000 && t < startMs
  })
}

function WeightDot(props: { cx?: number; cy?: number; payload?: { enLuteo?: boolean } }) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return <></>
  return payload?.enLuteo
    ? <circle cx={cx} cy={cy} r={5} fill={LUTEAL_COLOR} stroke="#fff" strokeWidth={1.5} />
    : <circle cx={cx} cy={cy} r={3} fill="#3f7d4f" />
}

// Tolerancia de la banda sombreada alrededor del peso meta — el peso
// fluctúa día a día (agua, digestión...), así que "estar en el objetivo" no
// es un único punto exacto sino un rango pequeño alrededor de la meta.
const GOAL_BAND_KG = 0.5

/** Esta ficha se monta siempre (oculta con CSS) para no perder el estado de
 * las demás pestañas al cambiar entre ellas — pero eso significa que
 * ResponsiveContainer puede medir 0×0 en el momento de montar, mientras su
 * contenedor todavía está en display:none. Este observer detecta cuando el
 * contenedor pasa a tener un tamaño real (se ha hecho visible) y fuerza un
 * remount del gráfico (vía key) en ese momento, para que no se quede en
 * blanco al cambiar de pestaña. */
function useRemountOnFirstVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [key, setKey] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.getBoundingClientRect().width > 0) return // ya visible al montar, nada que hacer
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setKey(k => k + 1)
        observer.disconnect()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, key }
}

export function WeightChart({ entries, goalKg, cycleEntries }: { entries: WeightEntry[]; goalKg?: number | null; cycleEntries?: CycleEntry[] }) {
  const { ref: chartContainerRef, key: chartKey } = useRemountOnFirstVisible<HTMLDivElement>()

  if (entries.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted">
        <Scale className="w-8 h-8 opacity-30 mb-2" />
        <p className="text-sm">Sin historial de peso suficiente todavía</p>
      </div>
    )
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const trend = movingAverage(sorted.map(w => w.weightKg), 3)
  const data = sorted.map((w, i) => ({
    fecha: new Date(w.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    kg: w.weightKg,
    tendencia: trend[i],
    enLuteo: isInLutealWindow(w.date, cycleEntries || []),
  }))
  const hasLutealPoints = data.some(d => d.enLuteo)
  const values = data.map(d => d.kg).concat(goalKg ? [goalKg - GOAL_BAND_KG, goalKg + GOAL_BAND_KG] : [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const cambio = data[data.length - 1].kg - data[0].kg
  const faltan = goalKg != null ? data[data.length - 1].kg - goalKg : null

  const cards = [
    { label: 'Peso inicial', value: `${data[0].kg} kg`, color: 'text-muted' },
    { label: 'Peso actual', value: `${data[data.length - 1].kg} kg`, color: 'text-ink' },
    goalKg != null
      ? { label: 'Para tu meta', value: `${faltan! >= 0 ? '−' : '+'}${Math.abs(faltan!).toFixed(1)} kg`, color: Math.abs(faltan!) < 0.1 ? 'text-ok' : 'text-accent' }
      : { label: 'Cambio total', value: `${cambio >= 0 ? '+' : ''}${cambio.toFixed(1)} kg`, color: cambio <= 0 ? 'text-ok' : 'text-warn' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {cards.map((k, i) => (
          <div key={i} className="bg-bg-alt rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="h-48" ref={chartContainerRef}>
        <ResponsiveContainer key={chartKey} width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gPeso" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3f7d4f" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3f7d4f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8a8278' }} />
            <YAxis domain={[min * 0.98, max * 1.02]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8a8278' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(value: number, name: string) => [`${Math.round(value * 10) / 10} kg`, name === 'tendencia' ? 'Tendencia' : 'Peso']} />
            {goalKg != null && (
              <ReferenceArea y1={goalKg - GOAL_BAND_KG} y2={goalKg + GOAL_BAND_KG} fill="#c17f3e" fillOpacity={0.1} strokeOpacity={0} />
            )}
            {goalKg != null && (
              <ReferenceLine y={goalKg} stroke="#c17f3e" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: `Meta: ${goalKg}kg`, position: 'insideTopRight', fontSize: 10, fill: '#c17f3e' }} />
            )}
            <Area type="monotone" dataKey="kg" name="Peso" stroke="#3f7d4f" strokeWidth={2.5} fill="url(#gPeso)" dot={<WeightDot />} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="tendencia" name="Tendencia" stroke="#8fae6c" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hasLutealPoints && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Moon className="w-3 h-3 flex-shrink-0" style={{ color: LUTEAL_COLOR }} />
          Puntos marcados en la semana previa al periodo — el peso puede subir 1-2.5kg por retención de líquidos, no por grasa.
        </p>
      )}
    </div>
  )
}
