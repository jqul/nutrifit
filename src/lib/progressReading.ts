// "¿Cómo vas?": una lectura en una frase del progreso del cliente, a partir de lo que ya se mide (peso, objetivo,
// adherencia y racha). Reglas sencillas y explicables; no sustituye el criterio del nutricionista.
import { summarizeWeight, weightDeltaTone } from './clientListSummary'
import { computeWeightProgress } from './weightProgress'

export type ReadingTone = 'good' | 'neutral' | 'attention'

export interface ProgressReading {
  tone: ReadingTone
  headline: string
  detail: string
  /** % conseguido del camino hacia el peso objetivo (null si no hay objetivo o no se puede calcular). */
  goalPercent: number | null
}

interface Input {
  weights: { date: string; weightKg: number }[]
  goal: string | null
  goalWeightKg: number | null
  adherence7d: number
  streak: number
  today?: Date
}

const LOW_ADHERENCE = 60

export function progressReading({ weights, goal, goalWeightKg, adherence7d, streak, today = new Date() }: Input): ProgressReading {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) {
    return { tone: 'neutral', headline: 'Aún es pronto para valorar', detail: 'Con un par de pesajes más podremos decirte cómo vas.', goalPercent: null }
  }
  const first = sorted[0].weightKg, last = sorted[sorted.length - 1].weightKg
  const goalPercent = goalWeightKg != null ? Math.round(computeWeightProgress(first, last, goalWeightKg).progressPct ?? 0) : null
  const reached = goalWeightKg != null && computeWeightProgress(first, last, goalWeightKg).goalReached
  if (reached) {
    return { tone: 'good', headline: '¡Has llegado a tu objetivo!', detail: 'Ahora toca mantenerlo: habla con tu nutricionista de los siguientes pasos.', goalPercent: 100 }
  }

  const recent = summarizeWeight(sorted, today, 28)?.deltaKg ?? null
  const tone = weightDeltaTone(goal, recent)
  const lowAdherence = adherence7d < LOW_ADHERENCE
  const streakNote = streak >= 7 ? ` Llevas ${streak} días de racha.` : ''

  if (tone === 'bad') {
    return {
      tone: 'attention', headline: 'El peso va en la dirección contraria',
      detail: lowAdherence
        ? `Esta semana has seguido el plan poco (${adherence7d}%): empieza por ahí y cuéntaselo a tu nutricionista.`
        : 'Sigues el plan, pero el peso no responde como se esperaba: comenta con tu nutricionista si hay que ajustar algo.',
      goalPercent,
    }
  }
  if (recent === 0 || (recent != null && Math.abs(recent) < 0.2 && (goal === 'perder_peso' || goal === 'ganar_masa'))) {
    return {
      tone: 'neutral', headline: 'El peso está estable',
      detail: lowAdherence ? `Con una adherencia del ${adherence7d}% esta semana, es normal que no se mueva: vuelve a la rutina.` : `Mantén el plan: los cambios no son lineales.${streakNote}`,
      goalPercent,
    }
  }
  if (tone === 'good') {
    return {
      tone: lowAdherence ? 'neutral' : 'good', headline: 'Vas en la dirección prevista',
      detail: lowAdherence ? `El peso responde, pero esta semana has seguido el plan poco (${adherence7d}%): no pierdas el ritmo.` : `Mantén el plan actual.${streakNote}`,
      goalPercent,
    }
  }
  // Mantenimiento, rendimiento, salud…: no se juzga la dirección del peso, solo si se mantiene el hábito.
  return {
    tone: lowAdherence ? 'neutral' : 'good', headline: lowAdherence ? 'Esta semana ha costado más' : 'Buen ritmo',
    detail: lowAdherence ? `Has seguido el plan un ${adherence7d}%: retómalo poco a poco.` : `Sigues el plan al ${adherence7d}%. Mantén el ritmo.${streakNote}`,
    goalPercent,
  }
}
