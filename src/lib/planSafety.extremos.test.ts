import { describe, it, expect } from 'vitest'
import { ActivityLevel, Formula, Goal, MetabolicInput, calculateMetabolicPlan } from './metabolicCalculator'
import { MACRO_ROUNDING_TOLERANCE_KCAL } from './planSafety'

// Datos EXTREMOS y combinaciones que NO están en la rejilla de 30.000: muestreo pseudoaleatorio con semilla fija sobre rangos amplios
// (peso, altura, edad, g/kg, % de grasa, las tres fórmulas, todos los niveles de actividad y objetivos), más las esquinas de cada rango.
//
// Sobre el «límite de 8 kcal»: 8 es solo lo observado en la rejilla; NO es un límite universal. Lo que sí se demuestra es la cota de 9:
// con proteína y grasa exactas y los hidratos = lo que queda, la suma EXACTA de macros es igual al objetivo exacto; por tanto, al redondear
// cada término (error ≤ 0,5 g), la suma mostrada difiere del objetivo mostrado como máximo 0,5·4 + 0,5·4 + 0,5·9 + 0,5 = 9 kcal. La cota
// se cumple para cualquier entrada que no se bloquee. Estas pruebas la comprueban con entradas fuera de la rejilla.
const TODAY = new Date(2026, 10, 19, 12)
const mulberry32 = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const FORMULAS: Formula[] = ['mifflin', 'harris', 'katch']
const ACTIVITIES: ActivityLevel[] = ['sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso']
const GOALS: Goal[] = ['deficit', 'mantenimiento', 'superavit']

interface Stats { n: number; presentados: number; bloqueados: number; incompatibles: number; conExceso: number; maxExceso: number; sinNota: number; noFinitos: number }

function comprobar(input: MetabolicInput, s: Stats) {
  const o = calculateMetabolicPlan(input); s.n++
  const codes = o.evaluation.signals.map(x => x.code)
  if (o.plan == null) {
    s.bloqueados++
    expect(o.evaluation.blocked, JSON.stringify(input)).toBe(true)
    expect(o.evaluation.signals.some(x => x.severity === 'bloqueo'), JSON.stringify(input)).toBe(true)
    if (codes.includes('MACROS_INCOMPATIBLES')) {
      s.incompatibles++
      expect(o.macros!.remainingKcalForCarbs).toBeLessThan(0) // incompatible ⇔ las cuentas exactas no cuadran, no por redondeo
    }
    return
  }
  s.presentados++
  const p = o.plan
  if (![p.bmr, p.tdee, p.kcalTarget, p.proteinG, p.carbsG, p.fatG, p.fiberG].every(Number.isFinite)) s.noFinitos++
  expect(p.carbsG).toBeGreaterThanOrEqual(0)
  // Lo presentado es compatible: con cuentas exactas proteína+grasa caben en el objetivo.
  expect(o.macros!.remainingKcalForCarbs, JSON.stringify(input)).toBeGreaterThanOrEqual(0)
  const exceso = p.proteinG * 4 + p.carbsG * 4 + p.fatG * 9 - p.kcalTarget
  expect(exceso, JSON.stringify(input)).toBeLessThanOrEqual(MACRO_ROUNDING_TOLERANCE_KCAL)
  expect(codes).not.toContain('MACROS_NO_CUADRAN') // una diferencia por redondeo nunca es una incoherencia
  expect(codes).not.toContain('MACROS_INCOMPATIBLES')
  if (exceso > 0) { s.conExceso++; s.maxExceso = Math.max(s.maxExceso, exceso); if (!codes.includes('MACROS_REDONDEO')) s.sinNota++ }
  else expect(codes).not.toContain('MACROS_REDONDEO')
}

describe('redondeo con datos extremos y combinaciones fuera de la rejilla', { timeout: 120_000 }, () => {
  it('60.000 entradas aleatorias de rangos amplios (semilla fija): la cota de 9 kcal se cumple y todo exceso lleva su nota', () => {
    const rnd = mulberry32(20261119)
    const between = (a: number, b: number) => a + (b - a) * rnd()
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
    const s: Stats = { n: 0, presentados: 0, bloqueados: 0, incompatibles: 0, conExceso: 0, maxExceso: 0, sinNota: 0, noFinitos: 0 }
    for (let i = 0; i < 60000; i++) {
      const formula = pick(FORMULAS)
      comprobar({
        formula, sex: formula === 'katch' && rnd() < 0.3 ? null : pick(['hombre', 'mujer'] as const),
        weightKg: Math.round(between(30, 400) * 10) / 10, heightCm: Math.round(between(100, 250)),
        age: Math.round(between(18, 110) * 10) / 10, bodyFatPct: Math.round(between(2, 70) * 10) / 10,
        activity: pick(ACTIVITIES), goal: pick(GOALS),
        proteinGPerKg: Math.round(between(0, 6) * 100) / 100, fatGPerKg: Math.round(between(0, 4) * 100) / 100,
        reproductiveStatus: 'ninguno', today: TODAY,
      }, s)
    }
    expect(s.n).toBe(60000)
    expect(s.noFinitos).toBe(0)
    expect(s.sinNota).toBe(0)
    expect(s.maxExceso).toBeLessThanOrEqual(MACRO_ROUNDING_TOLERANCE_KCAL)
    expect(s.presentados).toBeGreaterThan(5000) // el muestreo no es trivial: hay presentados y bloqueados
    expect(s.incompatibles).toBeGreaterThan(5000)
  })
  it('las esquinas de cada rango (peso, altura, edad, g/kg) con todas las fórmulas, actividades y objetivos', () => {
    const s: Stats = { n: 0, presentados: 0, bloqueados: 0, incompatibles: 0, conExceso: 0, maxExceso: 0, sinNota: 0, noFinitos: 0 }
    for (const formula of FORMULAS) for (const activity of ACTIVITIES) for (const goal of GOALS)
      for (const weightKg of [30, 400]) for (const heightCm of [100, 250]) for (const age of [18, 110]) for (const proteinGPerKg of [0, 6]) for (const fatGPerKg of [0, 4])
        comprobar({ formula, sex: 'mujer', weightKg, heightCm, age, bodyFatPct: formula === 'katch' ? 5 : undefined, activity, goal, proteinGPerKg, fatGPerKg, reproductiveStatus: 'ninguno', today: TODAY }, s)
    expect(s.n).toBe(3 * 5 * 3 * 2 * 2 * 2 * 2 * 2)
    expect(s.noFinitos).toBe(0)
    expect(s.sinNota).toBe(0)
  })
  it('fuera de los rangos válidos no se calcula nada y nunca sale NaN ni un reparto', () => {
    const base: MetabolicInput = { formula: 'mifflin', sex: 'mujer', weightKg: 65, heightCm: 165, age: 35, activity: 'moderado', goal: 'mantenimiento', proteinGPerKg: 1.6, fatGPerKg: 1, today: TODAY }
    for (const over of [{ weightKg: 29.9 }, { weightKg: 400.1 }, { heightCm: 99 }, { heightCm: 251 }, { age: 110.1 }, { age: -1 }, { weightKg: NaN }, { heightCm: Infinity }, { proteinGPerKg: -0.01 }, { fatGPerKg: NaN }, { activity: 'x' as never }]) {
      const o = calculateMetabolicPlan({ ...base, ...over })
      expect(o.plan, JSON.stringify(over)).toBeNull()
      expect(o.energy, JSON.stringify(over)).toBeNull()
    }
  })
  it('la diferencia por redondeo y la incompatibilidad energética son cosas distintas: una proteína+grasa que apenas supera el objetivo es incompatible aunque la diferencia sea de 1 kcal', () => {
    // Con cuentas exactas no hay tolerancia: si proteína + grasa superan el objetivo, no hay calorías para hidratos, por poco que sea.
    // (mujer 50 kg, P 3 g/kg y G 2 g/kg: sobran 359 kcal; se busca además un caso mínimo variando la grasa)
    let hallado = false
    for (let g = 1.5; g <= 1.8 && !hallado; g += 0.001) { // el resto exacto pasa por cero hacia g ≈ 1,645
      const o = calculateMetabolicPlan({ formula: 'mifflin', sex: 'mujer', weightKg: 50, heightCm: 160, age: 30, activity: 'sedentario', goal: 'deficit', proteinGPerKg: 2, fatGPerKg: g, reproductiveStatus: 'ninguno', today: TODAY })
      const resto = o.macros!.remainingKcalForCarbs
      if (resto < 0 && resto > -2) { hallado = true; expect(o.plan).toBeNull(); expect(o.evaluation.signals.map(x => x.code)).toContain('MACROS_INCOMPATIBLES') }
    }
    expect(hallado).toBe(true)
  })
})
