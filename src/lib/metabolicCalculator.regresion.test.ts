import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_FACTORS, GOAL_ADJUSTMENTS, ActivityLevel, Goal, MetabolicInput, calculateMetabolicPlan, computeMetabolicPlan,
  bmrHarrisBenedict, bmrKatchMcArdle, bmrMifflinStJeor,
} from './metabolicCalculator'

// Regresión de la auditoría de la calculadora (2026-11-18, sobre origin/main e026a3a). Cada caso fija el comportamiento NUEVO frente
// al hallazgo: qué se calculaba antes y qué ocurre ahora. Las cifras de los casos ordinarios no cambian; lo que cambia es lo que antes
// se calculaba sin sentido (menores, sexo supuesto, datos imposibles, macros que superaban el objetivo) y que ahora se señala.
const TODAY = new Date(2026, 10, 18, 12)
const base: MetabolicInput = {
  formula: 'mifflin', sex: 'mujer', weightKg: 50, heightCm: 160, age: 30, activity: 'sedentario', goal: 'deficit',
  proteinGPerKg: 2, fatGPerKg: 1, reproductiveStatus: 'ninguno', today: TODAY,
}
const calc = (over: Partial<MetabolicInput> = {}) => calculateMetabolicPlan({ ...base, ...over })
const codes = (o: ReturnType<typeof calc>) => o.evaluation.signals.map(s => s.code)

describe('A1 · mujer de 50 kg, sedentaria, con déficit (el caso de la auditoría)', () => {
  it('se sigue calculando, pero con señales: el objetivo está por debajo de la TMB y del umbral de revisión', () => {
    const o = calc()
    expect(o.plan).toEqual({ bmr: 1189, tdee: 1427, kcalTarget: 1141, proteinG: 100, fatG: 50, carbsG: 73, fiberG: 16 })
    expect(codes(o)).toEqual(expect.arrayContaining(['OBJETIVO_BAJO_TMB', 'OBJETIVO_BAJO_UMBRAL']))
    expect(o.evaluation).toMatchObject({ level: 'revision', blocked: false, needsProfessionalReview: true })
  })
  it('155 cm y 44 años → 1.044 kcal (el 1.045 de la auditoría): calculado, señalado y con 49 g de hidratos (aviso)', () => {
    const o = calc({ heightCm: 155, age: 44 })
    expect(o.plan).toMatchObject({ bmr: 1088, tdee: 1305, kcalTarget: 1044, carbsG: 49 })
    expect(codes(o)).toEqual(expect.arrayContaining(['OBJETIVO_BAJO_TMB', 'OBJETIVO_BAJO_UMBRAL', 'CARBOHIDRATOS_BAJOS']))
    expect(o.evaluation.needsProfessionalReview).toBe(true)
  })
  it('sedentario + déficit da SIEMPRE 0,96 × TMB: la señal de TMB aparece en todas las fórmulas y edades', () => {
    for (const formula of ['mifflin', 'harris'] as const) for (const age of [20, 30, 45, 60]) for (const w of [50, 70, 95]) {
      const o = calc({ formula, age, weightKg: w, heightCm: 168 })
      expect(o.energy!.kcalTarget / o.energy!.bmr, `${formula} ${age} ${w}`).toBeCloseTo(0.96, 2)
      expect(codes(o), `${formula} ${age} ${w}`).toContain('OBJETIVO_BAJO_TMB')
    }
    expect(codes(calc({ formula: 'katch', bodyFatPct: 25 }))).toContain('OBJETIVO_BAJO_TMB')
  })
  it('con actividad ligera o más, el déficit del 20 % ya no deja el objetivo bajo la TMB', () => {
    for (const activity of ['ligero', 'moderado', 'intenso', 'muy_intenso'] as ActivityLevel[]) expect(codes(calc({ activity, weightKg: 70, heightCm: 170 })), activity).not.toContain('OBJETIVO_BAJO_TMB')
  })
  it('el umbral de revisión es configurable: con 1.000 kcal desaparece su señal y la de la TMB se mantiene', () => {
    const o = calc({ thresholds: { minKcalReview: 1000 } })
    expect(codes(o)).not.toContain('OBJETIVO_BAJO_UMBRAL')
    expect(codes(o)).toContain('OBJETIVO_BAJO_TMB')
  })
})

describe('A2/A3 · casos ordinarios: las cifras no cambian', () => {
  const casos: [string, Partial<MetabolicInput>, Record<string, number>][] = [
    ['hombre 30a 80kg 180cm moderado déficit', { sex: 'hombre', weightKg: 80, heightCm: 180, activity: 'moderado' }, { bmr: 1780, tdee: 2759, kcalTarget: 2207, proteinG: 160, fatG: 80, carbsG: 212, fiberG: 31 }],
    ['hombre 45a 100kg 175cm ligero déficit', { sex: 'hombre', weightKg: 100, heightCm: 175, age: 45, activity: 'ligero' }, { bmr: 1874, tdee: 2576, kcalTarget: 2061, proteinG: 200, fatG: 100, carbsG: 90, fiberG: 29 }],
    ['hombre 70a 70kg 170cm sedentario mantenimiento', { sex: 'hombre', weightKg: 70, heightCm: 170, age: 70, goal: 'mantenimiento' }, { bmr: 1418, tdee: 1701, kcalTarget: 1701, proteinG: 140, fatG: 70, carbsG: 128, fiberG: 24 }],
    ['mujer 25a 60kg 165cm moderado déficit', { weightKg: 60, heightCm: 165, age: 25, activity: 'moderado' }, { bmr: 1345, tdee: 2085, kcalTarget: 1668, proteinG: 120, fatG: 60, carbsG: 162, fiberG: 23 }],
    ['mujer 35a 90kg 165cm ligero déficit', { weightKg: 90, heightCm: 165, age: 35, activity: 'ligero' }, { bmr: 1595, tdee: 2193, kcalTarget: 1755, proteinG: 180, fatG: 90, carbsG: 56, fiberG: 25 }],
    ['mujer 28a 60kg 168cm Katch 18% moderado mantenimiento', { formula: 'katch', bodyFatPct: 18, weightKg: 60, heightCm: 168, age: 28, activity: 'moderado', goal: 'mantenimiento' }, { bmr: 1433, tdee: 2221, kcalTarget: 2221, proteinG: 120, fatG: 60, carbsG: 300, fiberG: 31 }],
    ['hombre 30a 80kg 180cm Katch 15% intenso superávit', { formula: 'katch', bodyFatPct: 15, sex: 'hombre', weightKg: 80, heightCm: 180, activity: 'intenso', goal: 'superavit' }, { bmr: 1839, tdee: 3172, kcalTarget: 3648, proteinG: 160, fatG: 80, carbsG: 572, fiberG: 51 }],
  ]
  it.each(casos)('%s', (_n, over, esperado) => {
    const o = calc(over)
    expect(o.plan).toEqual(esperado)
    expect(o.evaluation.blocked).toBe(false)
    expect(o.evaluation.needsProfessionalReview).toBe(false) // adultos con un objetivo razonable: ninguna señal de revisión
  })
  it('hombre y mujer con las tres fórmulas: las ecuaciones y el resultado final', () => {
    const p = { weightKg: 70, heightCm: 168, age: 35, activity: 'ligero' as const, goal: 'mantenimiento' as const, bodyFatPct: 25 }
    const por = (formula: 'mifflin' | 'harris' | 'katch', sex: 'hombre' | 'mujer') => calc({ ...p, formula, sex }).plan!
    expect(por('mifflin', 'mujer').bmr).toBe(1414)
    expect(por('harris', 'mujer').bmr).toBe(1464)
    expect(por('katch', 'mujer').bmr).toBe(1504)
    expect(por('katch', 'hombre').bmr).toBe(por('katch', 'mujer').bmr) // Katch no depende del sexo
    expect(por('mifflin', 'hombre').bmr).toBe(Math.round(bmrMifflinStJeor('hombre', 70, 168, 35)))
    expect(por('harris', 'hombre').bmr).toBe(Math.round(bmrHarrisBenedict('hombre', 70, 168, 35)))
    expect(por('katch', 'mujer').bmr).toBe(Math.round(bmrKatchMcArdle(70, 25)))
  })
  it('las ecuaciones sueltas no han cambiado', () => {
    expect(bmrMifflinStJeor('hombre', 80, 180, 30)).toBe(1780)
    expect(bmrMifflinStJeor('mujer', 60, 165, 28)).toBeCloseTo(1330.25)
    expect(bmrHarrisBenedict('hombre', 80, 180, 30)).toBeCloseTo(1853.6, 1)
    expect(bmrKatchMcArdle(80, 15)).toBeCloseTo(1838.8)
  })
})

describe('A4 · menores: las ecuaciones de adultos no se usan', () => {
  it.each([17, 16, 15, 12, 10, 8, 5, 3, 1, 0])('%i años: sin cálculo ni TMB, con MENOR_DE_EDAD', age => {
    for (const formula of ['mifflin', 'harris', 'katch'] as const) {
      const o = calc({ age, formula, bodyFatPct: 20, weightKg: age < 10 ? 25 : 55, heightCm: age < 10 ? 120 : 165 })
      expect(o.plan, `${formula} ${age}`).toBeNull()
      expect(o.energy, `${formula} ${age}`).toBeNull()
      expect(codes(o)).toContain('MENOR_DE_EDAD')
      expect(o.evaluation.blocked).toBe(true)
      expect(computeMetabolicPlan({ ...base, age, formula, bodyFatPct: 20 })).toBeNull()
    }
  })
  it('el caso de la niña de 5 años y 18 kg que antes recibía 736 kcal: ahora no se calcula', () => {
    expect(calc({ age: 5, weightKg: 18, heightCm: 108, activity: 'ligero' }).plan).toBeNull()
  })
  it('17,9 años sigue siendo menor; 18 ya no, con aviso por estar fuera de la muestra de Mifflin', () => {
    expect(calc({ age: 17.9 }).plan).toBeNull()
    const o = calc({ age: 18, activity: 'moderado', weightKg: 60, heightCm: 165 })
    expect(o.plan).not.toBeNull()
    expect(codes(o)).toContain('EDAD_FUERA_DE_MUESTRA')
  })
  it('la fecha de nacimiento de la ficha también se tiene en cuenta (edad escrita incoherente)', () => {
    const o = calc({ age: 30, birthDate: '2010-05-05', activity: 'moderado', weightKg: 60, heightCm: 165 })
    expect(codes(o)).toContain('EDAD_INCOHERENTE')
  })
})

describe('A5 · embarazo y lactancia', () => {
  it('con déficit no se genera ningún objetivo (ni siquiera la TMB)', () => {
    for (const reproductiveStatus of ['embarazo', 'lactancia'] as const) {
      const o = calc({ reproductiveStatus, goal: 'deficit', weightKg: 65, heightCm: 165, activity: 'moderado' })
      expect(o.plan).toBeNull()
      expect(o.energy).toBeNull()
      expect(codes(o)).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
    }
  })
  it('con mantenimiento o superávit se calcula, pero pide revisión profesional y el profesional debe confirmar', () => {
    for (const reproductiveStatus of ['embarazo', 'lactancia'] as const) for (const goal of ['mantenimiento', 'superavit'] as Goal[]) {
      const o = calc({ reproductiveStatus, goal, weightKg: 65, heightCm: 165, activity: 'moderado' })
      expect(o.plan, `${reproductiveStatus} ${goal}`).not.toBeNull()
      expect(codes(o)).toContain('EMBARAZO_LACTANCIA_REVISION')
      expect(o.evaluation.needsProfessionalReview).toBe(true)
    }
  })
  it('sin información (no consta) no se bloquea: solo una nota informativa; con «no», ni eso', () => {
    const noConsta = calc({ reproductiveStatus: 'no_consta', weightKg: 65, heightCm: 165, activity: 'moderado' })
    expect(noConsta.plan).not.toBeNull()
    expect(codes(noConsta)).toContain('EMBARAZO_LACTANCIA_NO_CONSTA')
    expect(codes(calc({ reproductiveStatus: 'ninguno', weightKg: 65, heightCm: 165, activity: 'moderado' })).filter(c => c !== 'MACROS_REDONDEO')).toEqual([])
  })
})

describe('A6 · proteína y grasa elevadas a la vez: el reparto incompatible no se presenta como válido', () => {
  it('mujer de 50 kg con P 3 g/kg y G 2 g/kg: el objetivo es 1.141 kcal y solo proteína+grasa suman 1.500 → bloqueado', () => {
    const o = calc({ proteinGPerKg: 3, fatGPerKg: 2 })
    expect(o.plan).toBeNull()
    expect(o.energy).toMatchObject({ kcalTarget: 1141 })
    expect(o.macros!.remainingKcalForCarbs).toBeCloseTo(-358.56, 1)
    expect(codes(o)).toContain('MACROS_INCOMPATIBLES')
    expect(o.evaluation.blocked).toBe(true)
  })
  it('P 2,5 y G 1,5: 1.175 kcal frente a 1.141 → también bloqueado (antes salía con 0 g de hidratos y +34 kcal)', () => {
    expect(calc({ proteinGPerKg: 2.5, fatGPerKg: 1.5 }).plan).toBeNull()
  })
  it('justo en el límite (hidratos 0 g exactos) se acepta, con aviso de hidratos bajos', () => {
    // objetivo 2000 kcal, proteína 100 g (400) + grasa 177,78 g (1600) → no cabe exacto con g/kg: se prueba con un peso que lo permita
    const o = calc({ sex: 'hombre', weightKg: 80, heightCm: 180, activity: 'moderado', goal: 'mantenimiento', proteinGPerKg: 2, fatGPerKg: 2.77 })
    expect(o.macros!.remainingKcalForCarbs).toBeGreaterThanOrEqual(0)
    expect(o.plan).not.toBeNull()
    expect(codes(o)).toContain('CARBOHIDRATOS_BAJOS')
  })
  it('proteína 4 g/kg sin grasa, o todo a 0: se aceptan (caben en el objetivo)', () => {
    expect(calc({ proteinGPerKg: 4, fatGPerKg: 0 }).plan).toMatchObject({ proteinG: 200, fatG: 0, carbsG: 85 })
    expect(calc({ proteinGPerKg: 0, fatGPerKg: 0 }).plan).toMatchObject({ proteinG: 0, fatG: 0, carbsG: 285 })
  })
  it('proteína negativa, NaN o infinita: dato inválido', () => {
    for (const v of [-1, NaN, Infinity]) {
      expect(calc({ proteinGPerKg: v }).plan).toBeNull()
      expect(codes(calc({ proteinGPerKg: v }))).toContain('DATO_INVALIDO')
      expect(codes(calc({ fatGPerKg: v }))).toContain('DATO_INVALIDO')
    }
  })
})

describe('A7 · datos ausentes, inválidos y extremos', () => {
  const nullo = (over: Partial<MetabolicInput>, code: string) => {
    const o = calc(over)
    expect(o.plan, JSON.stringify(over)).toBeNull()
    expect(codes(o), JSON.stringify(over)).toContain(code)
  }
  it('ausentes', () => {
    nullo({ weightKg: 0 }, 'PESO_AUSENTE'); nullo({ weightKg: NaN }, 'PESO_AUSENTE'); nullo({ weightKg: -50 }, 'PESO_AUSENTE')
    nullo({ heightCm: 0 }, 'ALTURA_AUSENTE'); nullo({ heightCm: NaN }, 'ALTURA_AUSENTE')
    nullo({ age: 0 }, 'MENOR_DE_EDAD'); nullo({ age: NaN }, 'EDAD_AUSENTE')
    nullo({ formula: 'katch' }, 'GRASA_AUSENTE'); nullo({ formula: 'katch', bodyFatPct: 0 }, 'GRASA_AUSENTE'); nullo({ formula: 'katch', bodyFatPct: 100 }, 'GRASA_AUSENTE')
  })
  it('imposibles: metros en vez de centímetros, edades de 120 y 200 años, pesos de 20 kg, grasa del 99 %', () => {
    nullo({ heightCm: 1.65 }, 'DATO_INVEROSIMIL'); nullo({ heightCm: 1 }, 'DATO_INVEROSIMIL'); nullo({ heightCm: 400 }, 'DATO_INVEROSIMIL')
    nullo({ age: 120 }, 'DATO_INVEROSIMIL'); nullo({ age: 200 }, 'DATO_INVEROSIMIL'); nullo({ age: -5 }, 'DATO_INVEROSIMIL')
    nullo({ weightKg: 20, heightCm: 100 }, 'DATO_INVEROSIMIL'); nullo({ weightKg: 500 }, 'DATO_INVEROSIMIL')
    nullo({ formula: 'katch', bodyFatPct: 99 }, 'DATO_INVEROSIMIL')
  })
  it('poco habituales pero posibles: se calculan con aviso (400 kg, 3 % de grasa, 105 años)', () => {
    const grande = calc({ sex: 'hombre', weightKg: 400, heightCm: 190, age: 40, goal: 'superavit', proteinGPerKg: 1, fatGPerKg: 1 })
    expect(grande.plan).not.toBeNull()
    expect(codes(grande)).toContain('DATO_INUSUAL')
    const magro = calc({ formula: 'katch', bodyFatPct: 3 })
    expect(magro.plan).not.toBeNull()
    expect(codes(magro)).toContain('DATO_INUSUAL')
    expect(codes(calc({ age: 105 }))).toContain('DATO_INUSUAL')
  })
  it('actividad u objetivo desconocidos ya no producen NaN: dato inválido', () => {
    nullo({ activity: 'x' as never }, 'DATO_INVALIDO'); nullo({ goal: 'x' as never }, 'DATO_INVALIDO')
    nullo({ activity: undefined as never }, 'DATO_INVALIDO')
  })
  it('sexo no informado: bloquea con Mifflin y Harris (no se asume), no con Katch', () => {
    nullo({ sex: null }, 'SEXO_NO_INFORMADO'); nullo({ sex: null, formula: 'harris' }, 'SEXO_NO_INFORMADO')
    expect(calc({ sex: null, formula: 'katch', bodyFatPct: 25 }).plan).not.toBeNull()
  })
  it('fecha de nacimiento futura: bloquea', () => { nullo({ birthDate: '2030-01-01' }, 'FECHA_NACIMIENTO_INVALIDA') })
  it('IMC bajo con déficit: se calcula pero pide revisión; sin déficit solo avisa', () => {
    const o = calc({ weightKg: 45, heightCm: 160 })
    expect(o.plan).not.toBeNull()
    expect(o.evaluation.signals.find(s => s.code === 'IMC_BAJO')!.severity).toBe('revision')
    expect(calc({ weightKg: 45, heightCm: 160, goal: 'mantenimiento', activity: 'moderado' }).evaluation.signals.find(s => s.code === 'IMC_BAJO')!.severity).toBe('advertencia')
  })
})

// La rejilla recorre 30.000 combinaciones: con la máquina cargada puede pasar de los 5 s por defecto.
describe('B · redondeos y coherencia en una rejilla de 30.000 combinaciones', { timeout: 60_000 }, () => {
  const legacy = (i: MetabolicInput) => {
    // La fórmula de siempre (origin/main e026a3a), para comprobar que no cambia nada en los casos que sí se calculan.
    const bmr = i.formula === 'mifflin' ? bmrMifflinStJeor(i.sex!, i.weightKg, i.heightCm, i.age) : i.formula === 'harris' ? bmrHarrisBenedict(i.sex!, i.weightKg, i.heightCm, i.age) : bmrKatchMcArdle(i.weightKg, i.bodyFatPct!)
    const tdee = bmr * ACTIVITY_FACTORS[i.activity]
    const kcal = tdee * (1 + GOAL_ADJUSTMENTS[i.goal])
    const p = i.proteinGPerKg * i.weightKg, f = i.fatGPerKg * i.weightKg
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcalTarget: Math.round(kcal), proteinG: Math.round(p), fatG: Math.round(f), carbsG: Math.round(Math.max(0, kcal - (p * 4 + f * 9)) / 4), fiberG: Math.round((kcal / 1000) * 14), exceeds: kcal - (p * 4 + f * 9) < 0 }
  }
  it('ningún reparto presentado como válido supera el objetivo; los que lo superan salen bloqueados; el resto coincide con la fórmula de siempre', () => {
    let n = 0, presentados = 0, bloqueadosPorMacros = 0, maxDeriva = 0
    for (const sex of ['hombre', 'mujer'] as const) for (const w of [45, 52, 60, 68, 75, 85, 100, 120]) for (const h of [150, 160, 170, 180, 190]) for (const age of [18, 25, 35, 50, 65])
      for (const activity of Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]) for (const goal of ['deficit', 'mantenimiento', 'superavit'] as Goal[])
        for (const [p, g] of [[1.6, 0.8], [2, 1], [2.2, 1.2], [2.5, 1.5], [3, 1.5]]) {
          const input: MetabolicInput = { formula: 'mifflin', sex, weightKg: w, heightCm: h, age, activity, goal, proteinGPerKg: p, fatGPerKg: g, reproductiveStatus: 'ninguno', today: TODAY }
          const o = calculateMetabolicPlan(input)
          const l = legacy(input)
          n++
          if (l.exceeds) {
            bloqueadosPorMacros++
            expect(o.plan, JSON.stringify(input)).toBeNull()
            expect(o.evaluation.signals.map(s => s.code), JSON.stringify(input)).toContain('MACROS_INCOMPATIBLES')
            continue
          }
          presentados++
          const { exceeds: _e, ...esperado } = l
          expect(o.plan, JSON.stringify(input)).toEqual(esperado)
          const suma = o.plan!.proteinG * 4 + o.plan!.carbsG * 4 + o.plan!.fatG * 9
          maxDeriva = Math.max(maxDeriva, Math.abs(suma - o.plan!.kcalTarget))
          expect(o.plan!.carbsG).toBeGreaterThanOrEqual(0)
          // Sin recortes silenciosos: con las cuentas exactas proteína+grasa nunca superan el objetivo; con gramos y kcal redondeados puede asomar
          // un pequeño resto de redondeo (máximo ~6,5 kcal: medio gramo de proteína y de grasa).
          expect(o.plan!.proteinG * 4 + o.plan!.fatG * 9, 'proteína+grasa no superan el objetivo').toBeLessThanOrEqual(o.plan!.kcalTarget + 8)
        }
    expect(n).toBe(30000)
    expect(bloqueadosPorMacros).toBeGreaterThan(2000) // los ~2.9 mil casos que antes salían con hidratos recortados a 0
    expect(presentados + bloqueadosPorMacros).toBe(30000)
    expect(maxDeriva).toBeLessThanOrEqual(10) // el redondeo a gramos enteros deja como mucho unas pocas kcal de diferencia
  })
  it('redondeo en casos ordinarios: la suma de macros difiere del objetivo en 2 kcal como mucho', () => {
    for (const w of [60, 70, 80]) {
      const p = calc({ sex: 'hombre', weightKg: w, heightCm: 175, age: 30, activity: 'moderado', goal: 'mantenimiento' }).plan!
      expect(Math.abs(p.proteinG * 4 + p.carbsG * 4 + p.fatG * 9 - p.kcalTarget)).toBeLessThanOrEqual(2)
    }
  })
  it('computeMetabolicPlan sigue siendo el atajo: devuelve lo mismo que outcome.plan', () => {
    expect(computeMetabolicPlan(base)).toEqual(calc().plan)
    expect(computeMetabolicPlan({ ...base, age: 12 })).toBeNull()
  })
})
