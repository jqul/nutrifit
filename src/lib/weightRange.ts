// Gráfica de peso con rangos (1M, 3M, 6M, 1A, Todo): qué pesajes entran, la línea de tendencia y las cifras de debajo
// (media, cambio y cambio de la tendencia en el periodo). Lógica pura; la pantalla solo la dibuja.

export type WeightRange = '1m' | '3m' | '6m' | '1y' | 'all'

export const WEIGHT_RANGES: { id: WeightRange; label: string; days: number | null }[] = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: '1y', label: '1A', days: 365 },
  { id: 'all', label: 'Todo', days: null },
]

interface Dated { date: string }
interface Weighed extends Dated { weightKg: number }

const DAY_MS = 86400000
const dayNumber = (iso: string) => Math.round(new Date(iso + 'T00:00:00Z').getTime() / DAY_MS)

/** Mitad de vida de la tendencia: pasados estos días, un pesaje pesa tanto como todo lo anterior. Con pesajes semanales
 * (lo normal aquí) cada pesaje nuevo mueve la tendencia casi la mitad del camino; con pesajes diarios, mucho menos. */
export const TREND_HALF_LIFE_DAYS = 6

/**
 * Tendencia del peso: media móvil exponencial que cuenta el tiempo real entre pesajes (un pesaje tras tres semanas
 * pesa más que uno tras un día) y da más peso a lo reciente. Quita el ruido del agua y de la hora del pesaje sin
 * «adelantarse» como una media centrada. Devuelve un valor por pesaje, en el mismo orden (que debe ser cronológico).
 */
export function trendSeries(entries: Weighed[], halfLifeDays = TREND_HALF_LIFE_DAYS): number[] {
  const out: number[] = []
  entries.forEach((e, i) => {
    if (i === 0) { out.push(e.weightKg); return }
    const gap = Math.max(0, dayNumber(e.date) - dayNumber(entries[i - 1].date))
    const alpha = 1 - Math.pow(0.5, gap / halfLifeDays)
    out.push(out[i - 1] + alpha * (e.weightKg - out[i - 1]))
  })
  return out
}

/** Índices de los pesajes (cronológicos) que caen dentro del rango, contando hacia atrás desde `todayISO`. */
export function indicesInRange(entries: Dated[], range: WeightRange, todayISO: string): number[] {
  const days = WEIGHT_RANGES.find(r => r.id === range)?.days ?? null
  const from = days == null ? -Infinity : dayNumber(todayISO) - days
  const idx: number[] = []
  entries.forEach((e, i) => { if (dayNumber(e.date) >= from) idx.push(i) })
  return idx
}

/** El rango con el que se abre la gráfica: «Todo» si el historial es corto, 3M si es largo (para no abrir con un enredo). */
export function defaultRange(entries: Dated[], todayISO: string): WeightRange {
  if (entries.length === 0) return 'all'
  const spanDays = dayNumber(todayISO) - dayNumber(entries[0].date)
  return spanDays > 120 ? '3m' : 'all'
}

export interface RangeStats {
  count: number
  averageKg: number
  /** Último menos primer pesaje del periodo (kg). */
  changeKg: number
  /** Lo mismo con la línea de tendencia: el cambio «de verdad», sin el ruido de un día. */
  trendChangeKg: number
}

/** Cifras del periodo. `null` si hay menos de 2 pesajes: con uno solo no hay cambio que contar. */
export function rangeStats(weights: number[], trend: number[]): RangeStats | null {
  if (weights.length < 2 || trend.length !== weights.length) return null
  const sum = weights.reduce((a, b) => a + b, 0)
  return {
    count: weights.length,
    averageKg: sum / weights.length,
    changeKg: weights[weights.length - 1] - weights[0],
    trendChangeKg: trend[trend.length - 1] - trend[0],
  }
}

/** Un valor con signo y un decimal, tal como se enseña («+0,4», «−1,2»). */
export function signedKg(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0,0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1).replace('.', ',')}`
}

/** ¿Hay al menos dos pesajes en este rango? Para apagar los botones de rangos sin nada que enseñar. */
export function rangeHasData(entries: Dated[], range: WeightRange, todayISO: string): boolean {
  return indicesInRange(entries, range, todayISO).length >= 2
}

const LS_KEY = 'nf_weight_range'

/** El rango que eligió la última vez (se recuerda en este dispositivo); `null` si no hay o no es válido. */
export function readSavedRange(): WeightRange | null {
  try {
    const v = localStorage.getItem(LS_KEY)
    return WEIGHT_RANGES.some(r => r.id === v) ? (v as WeightRange) : null
  } catch { return null }
}

export function saveRange(range: WeightRange): void {
  try { localStorage.setItem(LS_KEY, range) } catch { /* sin almacenamiento: se abre con el rango por defecto */ }
}
