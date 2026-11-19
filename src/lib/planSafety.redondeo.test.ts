import { describe, it, expect } from 'vitest'
import { ACTIVITY_FACTORS, ActivityLevel, Goal, MetabolicInput, calculateMetabolicPlan } from './metabolicCalculator'
import { DEFAULT_REVIEW_THRESHOLDS, MACRO_ROUNDING_TOLERANCE_KCAL, reproductiveCheckFromQuery } from './planSafety'

const TODAY = new Date(2026, 10, 19, 12)

describe('tolerancias de macros: redondeo frente a incoherencia energética', () => {
  it('son dos tolerancias distintas, con su unidad y su origen', () => {
    expect(DEFAULT_REVIEW_THRESHOLDS.macroRoundingKcal).toBe(MACRO_ROUNDING_TOLERANCE_KCAL)
    expect(MACRO_ROUNDING_TOLERANCE_KCAL).toBe(9) // 0,5 g de proteína (2) + 0,5 de hidratos (2) + 0,5 de grasa (4,5) + 0,5 kcal
    expect(2 + 2 + 4.5 + 0.5).toBe(MACRO_ROUNDING_TOLERANCE_KCAL)
    expect(DEFAULT_REVIEW_THRESHOLDS.macroTolerancePct).toBe(3) // incoherencia por debajo del objetivo, en %
  })
})

describe('macros redondeados: se evalúan los gramos enteros que realmente se ven', { timeout: 60_000 }, () => {
  // La misma rejilla de 30.000 combinaciones de la auditoría, evaluando lo que se muestra.
  it('ningún resultado supera el objetivo más que el redondeo; todo exceso se dice; ninguno se presenta incompatible', () => {
    let presentados = 0, conExceso = 0, maxExceso = 0, exceso5 = 0, bloqueadosPorMacros = 0, sinSenal = 0
    for (const sex of ['hombre', 'mujer'] as const) for (const w of [45, 52, 60, 68, 75, 85, 100, 120]) for (const h of [150, 160, 170, 180, 190]) for (const age of [18, 25, 35, 50, 65])
      for (const activity of Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]) for (const goal of ['deficit', 'mantenimiento', 'superavit'] as Goal[])
        for (const [p, g] of [[1.6, 0.8], [2, 1], [2.2, 1.2], [2.5, 1.5], [3, 1.5]]) {
          const input: MetabolicInput = { formula: 'mifflin', sex, weightKg: w, heightCm: h, age, activity, goal, proteinGPerKg: p, fatGPerKg: g, reproductiveStatus: 'ninguno', today: TODAY }
          const o = calculateMetabolicPlan(input)
          const codes = o.evaluation.signals.map(s => s.code)
          if (o.plan == null) { expect(codes, JSON.stringify(input)).toContain('MACROS_INCOMPATIBLES'); bloqueadosPorMacros++; continue }
          presentados++
          const suma = o.plan.proteinG * 4 + o.plan.carbsG * 4 + o.plan.fatG * 9
          const exceso = suma - o.plan.kcalTarget
          // Cota teórica: lo que se ve nunca supera el objetivo más que el redondeo.
          expect(exceso, JSON.stringify(input)).toBeLessThanOrEqual(MACRO_ROUNDING_TOLERANCE_KCAL)
          expect(codes, JSON.stringify(input)).not.toContain('MACROS_NO_CUADRAN')
          if (exceso > 0) {
            conExceso++; maxExceso = Math.max(maxExceso, exceso); if (exceso > 5) exceso5++
            // ...y cuando lo hay, SE DICE (nota informativa), no se presenta en silencio.
            if (!codes.includes('MACROS_REDONDEO')) sinSenal++
          } else expect(codes).not.toContain('MACROS_REDONDEO')
        }
    expect(presentados + bloqueadosPorMacros).toBe(30000)
    expect(sinSenal).toBe(0)
    expect(maxExceso).toBeLessThanOrEqual(MACRO_ROUNDING_TOLERANCE_KCAL)
    // Cuantificación fijada (misma rejilla, valores mostrados en gramos enteros): se comprueba que sigue habiendo casos con exceso por
    // redondeo (para que la nota exista de verdad) y que el máximo observado está acotado.
    expect(conExceso).toBeGreaterThan(0)
    globalThis.__redondeoRejilla = { presentados, bloqueadosPorMacros, conExceso, exceso5, maxExceso }
  })
  it('un caso concreto: la nota dice cuántas kcal de más suman los gramos enteros', () => {
    // Se busca un caso con exceso y se comprueba el texto de la nota.
    for (const w of [52, 61, 67, 73, 79, 88]) {
      const o = calculateMetabolicPlan({ formula: 'mifflin', sex: 'mujer', weightKg: w, heightCm: 163, age: 41, activity: 'ligero', goal: 'deficit', proteinGPerKg: 2.3, fatGPerKg: 1.3, reproductiveStatus: 'ninguno', today: TODAY })
      const nota = o.evaluation.signals.find(s => s.code === 'MACROS_REDONDEO')
      if (nota && o.plan) {
        expect(nota.severity).toBe('info')
        expect(nota.explanation).toMatch(/Es redondeo \(como mucho 9 kcal\)/)
        const suma = o.plan.proteinG * 4 + o.plan.carbsG * 4 + o.plan.fatG * 9
        expect(nota.evidence).toMatchObject({ kcal: o.plan.kcalTarget, kcalDeMacros: suma, diferencia: suma - o.plan.kcalTarget })
        return
      }
    }
  })
})

describe('estado de la comprobación del cuestionario en la calculadora', () => {
  const base: MetabolicInput = { formula: 'mifflin', sex: 'mujer', weightKg: 65, heightCm: 165, age: 35, activity: 'moderado', goal: 'mantenimiento', proteinGPerKg: 1.6, fatGPerKg: 1, today: TODAY }
  it('cargando bloquea el cálculo; error lo permite con señal de revisión; leído no señala nada', () => {
    const cargando = calculateMetabolicPlan({ ...base, reproductiveStatus: 'no_consta', reproductiveCheck: 'loading' })
    expect(cargando.plan).toBeNull()
    expect(cargando.evaluation.signals.map(s => s.code)).toContain('ANAMNESIS_NO_COMPROBADA')
    const error = calculateMetabolicPlan({ ...base, reproductiveStatus: 'no_consta', reproductiveCheck: 'error' })
    expect(error.plan).not.toBeNull()
    expect(error.evaluation.needsProfessionalReview).toBe(true)
    const leido = calculateMetabolicPlan({ ...base, reproductiveStatus: 'no_consta', reproductiveCheck: 'ready' })
    expect(leido.evaluation.signals.map(s => s.code)).not.toContain('ANAMNESIS_NO_COMPROBADA')
  })
})

describe('reproductiveCheckFromQuery', () => {
  it('sin fila (el cliente no ha rellenado el cuestionario) es «leído» con respuesta vacía: NO es un error', () => {
    expect(reproductiveCheckFromQuery(null, null)).toEqual({ check: 'ready', answer: '' })
    expect(reproductiveCheckFromQuery({ answers: {} }, null)).toEqual({ check: 'ready', answer: '' })
    expect(reproductiveCheckFromQuery({ answers: null }, null)).toEqual({ check: 'ready', answer: '' })
  })
  it('con respuesta, la devuelve', () => {
    expect(reproductiveCheckFromQuery({ answers: { embarazo_lactancia: 'Embarazo' } }, null)).toEqual({ check: 'ready', answer: 'Embarazo' })
  })
  it('un error de consulta es «error» y NUNCA se convierte en «no consta», aunque llegaran datos', () => {
    expect(reproductiveCheckFromQuery(null, new Error('boom'))).toEqual({ check: 'error', answer: '' })
    expect(reproductiveCheckFromQuery({ answers: { embarazo_lactancia: 'No (o no me aplica)' } }, { message: 'RLS' })).toEqual({ check: 'error', answer: '' })
  })
})

declare global { var __redondeoRejilla: unknown }
