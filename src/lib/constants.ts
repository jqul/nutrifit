import { PresetGoal } from '../types'

export const GOAL_LABELS: Record<PresetGoal, string> = {
  perder_peso: 'Perder peso',
  ganar_masa: 'Ganar masa',
  mantenimiento: 'Mantenimiento',
  rendimiento: 'Rendimiento',
  salud: 'Salud general',
}

export const GOAL_OPTIONS: PresetGoal[] = ['perder_peso', 'ganar_masa', 'mantenimiento', 'rendimiento', 'salud']

// El objetivo del cliente es texto libre — si coincide con uno predefinido se
// traduce, si no se muestra tal cual lo escribió el nutricionista.
export function goalLabel(goal: string | null): string {
  if (!goal) return '—'
  return (GOAL_LABELS as Record<string, string>)[goal] || goal
}

export const FOLLOWED_PLAN_LABELS: Record<'si' | 'parcial' | 'no', string> = {
  si: 'Sí, lo seguí',
  parcial: 'Parcialmente',
  no: 'No lo seguí',
}
