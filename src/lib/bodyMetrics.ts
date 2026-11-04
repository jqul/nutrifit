// Medidas corporales y métricas propias (% de grasa, cintura, «pliegue tricipital»…). El peso no entra aquí: sigue en weight_logs.

export interface MetricDefinition {
  id: string
  /** Fija para las estándar (para crearlas una sola vez por nutricionista); null en las propias. */
  key: string | null
  name: string
  unit: string
  /** Si el cliente la ve en su app. */
  clientVisible: boolean
  sortOrder: number
}

export interface MetricValue { id: string; clientId: string; metricId: string; date: string; value: number }

export interface MetricPoint { date: string; value: number }

/** Las que lleva cualquier consulta; se crean (una vez) la primera vez que el nutricionista abre las medidas. */
export const STANDARD_METRICS: { key: string; name: string; unit: string }[] = [
  { key: 'body_fat_pct', name: '% grasa corporal', unit: '%' },
  { key: 'waist_cm', name: 'Cintura', unit: 'cm' },
  { key: 'hip_cm', name: 'Cadera', unit: 'cm' },
  { key: 'chest_cm', name: 'Pecho', unit: 'cm' },
  { key: 'arm_cm', name: 'Brazo', unit: 'cm' },
  { key: 'thigh_cm', name: 'Muslo', unit: 'cm' },
]

/** Las estándar que este nutricionista todavía no tiene creadas. */
export function missingStandardMetrics(defs: Pick<MetricDefinition, 'key'>[]): typeof STANDARD_METRICS {
  const have = new Set(defs.map(d => d.key).filter(Boolean))
  return STANDARD_METRICS.filter(m => !have.has(m.key))
}

/** «82,5» o «82.5» → 82.5; vacío o fuera de rango (≤ 0 o ≥ 10000) → null. */
export function parseMetricInput(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(clean)) return null
  const n = Number(clean)
  return n > 0 && n < 10000 ? Math.round(n * 100) / 100 : null
}

const nf = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

export function formatMetricValue(value: number, unit: string): string {
  return unit ? `${nf(value)} ${unit}` : nf(value)
}

/** «−1,5 cm», «+0,3 %» o «sin cambios». */
export function formatMetricDelta(delta: number, unit: string): string {
  const rounded = Math.round(delta * 100) / 100
  if (rounded === 0) return 'sin cambios'
  return `${rounded > 0 ? '+' : '−'}${nf(Math.abs(rounded))}${unit ? ` ${unit}` : ''}`
}

export interface MetricSummary {
  latest: MetricPoint
  previous: MetricPoint | null
  first: MetricPoint
  /** Cambio desde la medida anterior (null si solo hay una). */
  deltaFromPrevious: number | null
  /** Cambio desde la primera medida (null si solo hay una). */
  deltaFromFirst: number | null
}

export function summarizeMetric(points: MetricPoint[]): MetricSummary | null {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null
  const first = sorted[0]
  return {
    latest, previous, first,
    deltaFromPrevious: previous ? latest.value - previous.value : null,
    deltaFromFirst: sorted.length > 1 ? latest.value - first.value : null,
  }
}

/** Los valores de una métrica de un cliente, de más antiguo a más reciente. */
export function pointsOf(values: Pick<MetricValue, 'metricId' | 'date' | 'value'>[], metricId: string): MetricPoint[] {
  return values.filter(v => v.metricId === metricId).map(v => ({ date: v.date, value: v.value })).sort((a, b) => a.date.localeCompare(b.date))
}

/** Las métricas que el cliente puede ver, en el orden del nutricionista, con al menos un valor. */
export function clientVisibleSeries(defs: MetricDefinition[], values: Pick<MetricValue, 'metricId' | 'date' | 'value'>[]) {
  return [...defs].filter(d => d.clientVisible).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    .map(def => ({ def, points: pointsOf(values, def.id) })).filter(s => s.points.length > 0)
}

/** El trazo (path de SVG) de una mini gráfica, de izquierda a derecha en el orden de las fechas. Vacío si hay menos de 2 puntos. */
export function sparklinePath(points: MetricPoint[], width: number, height: number, pad = 2): string {
  if (points.length < 2) return ''
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const vals = sorted.map(p => p.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  return sorted.map((p, i) => {
    const x = pad + (i / (sorted.length - 1)) * (width - 2 * pad)
    const y = max === min ? height / 2 : height - pad - ((p.value - min) / span) * (height - 2 * pad)
    return `${i === 0 ? 'M' : 'L'}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`
  }).join(' ')
}
