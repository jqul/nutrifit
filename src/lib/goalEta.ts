// Fecha estimada para llegar al peso objetivo, al ritmo de las últimas semanas. Es una proyección orientativa, no una promesa:
// solo se calcula cuando hay datos suficientes y el peso va hacia el objetivo, y en cualquier otro caso se calla (no hay
// «vas lejos» ni «no avanzas»: eso lo valora el nutricionista, no una fórmula).
import { trendSeries } from './weightRange'

export type GoalEta =
  | { kind: 'reached' }
  | { kind: 'eta'; dateISO: string; weeks: number; ratePerWeekKg: number }
  /** El peso no se mueve o va en dirección contraria al objetivo. */
  | { kind: 'not-moving' }
  /** Al ritmo actual tardaría más de un año: la cifra no sería creíble. */
  | { kind: 'too-far' }
  /** Faltan pesajes recientes o abarcan pocos días. */
  | { kind: 'too-early' }

interface Weighed { date: string; weightKg: number }

const WINDOW_DAYS = 28
const MIN_POINTS = 3
const MIN_SPAN_DAYS = 14
/** Si el último pesaje es más viejo que esto, el ritmo ya no es «el de ahora». */
const MAX_STALE_DAYS = 14
/** A menos de esto del objetivo (sobre la tendencia) ya se considera alcanzado. */
const REACHED_BAND_KG = 0.3
/** Por debajo de este ritmo semanal el peso se considera parado. */
const MIN_RATE_KG_PER_WEEK = 0.05
const MAX_WEEKS = 52

const DAY_MS = 86400000
const dayNumber = (iso: string) => Math.round(new Date(iso + 'T00:00:00Z').getTime() / DAY_MS)
const isoOfDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10)

export function goalEta(weights: Weighed[], goalKg: number | null, todayISO: string): GoalEta {
  if (goalKg == null || weights.length === 0) return { kind: 'too-early' }
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const trend = trendSeries(sorted)
  const lastIdx = sorted.length - 1
  const lastDay = dayNumber(sorted[lastIdx].date)
  if (dayNumber(todayISO) - lastDay > MAX_STALE_DAYS) return { kind: 'too-early' }

  const remaining = goalKg - trend[lastIdx]
  if (Math.abs(remaining) <= REACHED_BAND_KG) return { kind: 'reached' }

  const idx: number[] = []
  sorted.forEach((w, i) => { if (dayNumber(w.date) >= lastDay - WINDOW_DAYS) idx.push(i) })
  const firstIdx = idx[0]
  const spanDays = lastDay - dayNumber(sorted[firstIdx].date)
  if (idx.length < MIN_POINTS || spanDays < MIN_SPAN_DAYS) return { kind: 'too-early' }

  // El ritmo sale de una recta ajustada (mínimos cuadrados) a los pesajes crudos de la ventana: la tendencia suavizada va
  // con retraso al arrancar y subestimaría el ritmo; la recta no. La tendencia solo sirve para saber dónde está el peso ahora.
  const xs = idx.map(i => dayNumber(sorted[i].date) - lastDay)
  const ys = idx.map(i => sorted[i].weightKg)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  const sxy = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0)
  const rate = (sxy / sxx) * 7
  if (Math.abs(rate) < MIN_RATE_KG_PER_WEEK || Math.sign(rate) !== Math.sign(remaining)) return { kind: 'not-moving' }

  const weeks = remaining / rate
  if (weeks > MAX_WEEKS) return { kind: 'too-far' }
  return { kind: 'eta', dateISO: isoOfDay(lastDay + Math.round(weeks * 7)), weeks, ratePerWeekKg: rate }
}

const kgPerWeek = (rate: number) => `${rate > 0 ? '+' : '−'}${Math.abs(rate).toFixed(1).replace('.', ',')} kg/semana`

/**
 * La frase para enseñar la estimación, o `null` si no hay nada que decir. `audience` cambia solo la persona gramatical:
 * «llegarías a tu objetivo» (cliente) o «llegaría a su objetivo» (nutricionista, que ve la ficha de otro).
 */
export function etaSentence(eta: GoalEta, todayISO: string, audience: 'client' | 'pro'): string | null {
  if (eta.kind !== 'eta') return null
  const target = new Date(eta.dateISO + 'T00:00:00Z')
  const sameYear = eta.dateISO.slice(0, 4) === todayISO.slice(0, 4)
  const when = target.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' })
  const who = audience === 'client' ? 'llegarías a tu objetivo' : 'llegaría a su objetivo'
  return `A este ritmo (${kgPerWeek(eta.ratePerWeekKg)}) ${who} hacia el ${when}. Es una estimación: cambia si cambia el ritmo.`
}
