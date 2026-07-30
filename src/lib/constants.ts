import { Goal } from '../types'

export const GOAL_LABELS: Record<Goal, string> = {
  perder_peso: 'Perder peso',
  ganar_masa: 'Ganar masa',
  mantenimiento: 'Mantenimiento',
  rendimiento: 'Rendimiento',
  salud: 'Salud general',
}

export const GOAL_OPTIONS: Goal[] = ['perder_peso', 'ganar_masa', 'mantenimiento', 'rendimiento', 'salud']

export const FOLLOWED_PLAN_LABELS: Record<'si' | 'parcial' | 'no', string> = {
  si: 'Sí, lo seguí',
  parcial: 'Parcialmente',
  no: 'No lo seguí',
}
