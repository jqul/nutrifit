// Cómo se cuenta el día en la pestaña Dieta del cliente: «Llevo X kcal» (lo consumido) o «Me quedan X kcal» (lo que resta).
// Cada persona prefiere una, así que se elige con un toque y se recuerda en el dispositivo.

export type DayView = 'consumed' | 'remaining'

const LS_KEY = 'nf_day_view'

export function readDayView(): DayView {
  try { return localStorage.getItem(LS_KEY) === 'remaining' ? 'remaining' : 'consumed' } catch { return 'consumed' }
}

export function saveDayView(view: DayView): void {
  try { localStorage.setItem(LS_KEY, view) } catch { /* sin almacenamiento: se abre en «consumido» */ }
}

/** El titular del día en la vista «me quedan»: lo que resta, o cuánto se ha pasado, dicho sin reproche. */
export function remainingHeadline(totalKcal: number, targetKcal: number): string {
  const diff = Math.round(targetKcal - totalKcal)
  if (diff >= 0) return `Te quedan ${diff} kcal`
  return `Hoy llevas ${-diff} kcal por encima`
}
