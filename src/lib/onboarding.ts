// Primeros pasos del nutricionista tras registrarse: qué ha hecho ya y qué le falta para empezar a usar NutriFit.

export type OnboardingStepId = 'profile' | 'client' | 'plan' | 'access'

export interface OnboardingStep { id: OnboardingStepId; title: string; hint: string; done: boolean }

export interface OnboardingInput {
  /** Tiene nombre y, al menos, logo o teléfono de contacto. */
  profileComplete: boolean
  clientCount: number
  /** Algún cliente tiene ya un plan de dieta con objetivos. */
  hasPlan: boolean
  /** Algún cliente ha entrado ya a su app (señal de que recibió el acceso). */
  anyClientEntered: boolean
}

export function onboardingSteps(i: OnboardingInput): OnboardingStep[] {
  return [
    { id: 'profile', title: 'Completa tu perfil', hint: 'Tu nombre, logo y teléfono: lo que ven tus clientes.', done: i.profileComplete },
    { id: 'client', title: 'Crea tu primer cliente', hint: 'Solo hace falta su nombre para empezar.', done: i.clientCount > 0 },
    { id: 'plan', title: 'Crea su primer plan de dieta', hint: 'Objetivos, comidas y alimentos; puedes partir de una plantilla.', done: i.hasPlan },
    { id: 'access', title: 'Envíale su acceso', hint: 'Copia su enlace desde su ficha y mándaselo por WhatsApp.', done: i.anyClientEntered },
  ]
}

export function onboardingProgress(steps: OnboardingStep[]): { done: number; total: number; percent: number; complete: boolean } {
  const done = steps.filter(s => s.done).length
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 100, complete: done === steps.length }
}

/** El primer paso que falta: a donde llevar al pulsar "Continuar". */
export function nextOnboardingStep(steps: OnboardingStep[]): OnboardingStep | null {
  return steps.find(s => !s.done) ?? null
}
