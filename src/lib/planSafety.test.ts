import { describe, it, expect } from 'vitest'
import {
  ADULT_AGE, DEFAULT_REVIEW_THRESHOLDS, INPUT_RANGES, PlanSignal, SafetyProfile, SignalCode, ageFromBirthDate, evaluatePlanSafety, isReproductiveActive,
  reproductiveStatusFromAnswer, sexFromGender, visibleSignals,
} from './planSafety'

const TODAY = new Date(2026, 10, 18, 12) // 18-nov-2026
const adult: SafetyProfile = { sex: 'mujer', ageYears: 35, weightKg: 65, heightCm: 165, formula: 'mifflin', losingWeight: false, reproductiveStatus: 'ninguno' }
const ev = (p: Partial<SafetyProfile> = {}, plan: Parameters<typeof evaluatePlanSafety>[1] = null, o: Parameters<typeof evaluatePlanSafety>[2] = {}) =>
  evaluatePlanSafety({ ...adult, ...p }, plan, { today: TODAY, ...o })
const codes = (e: { signals: PlanSignal[] }) => e.signals.map(s => s.code)
const find = (e: { signals: PlanSignal[] }, c: SignalCode) => e.signals.find(s => s.code === c)

describe('estructura de las señales', () => {
  it('cada señal trae código, gravedad, base, título, explicación y evidencia', () => {
    const e = ev({ ageYears: 12 })
    const s = find(e, 'MENOR_DE_EDAD')!
    expect(s).toMatchObject({ code: 'MENOR_DE_EDAD', severity: 'bloqueo', basis: 'decision_de_producto' })
    expect(s.title.length).toBeGreaterThan(5)
    expect(s.explanation.length).toBeGreaterThan(30)
    expect(s.evidence).toMatchObject({ edad: 12, mayoriaDeEdad: ADULT_AGE })
  })
  it('un perfil adulto, completo y sin plan no genera ninguna señal', () => {
    const e = ev()
    expect(e.signals).toEqual([])
    expect(e).toMatchObject({ level: 'ok', blocked: false, needsProfessionalReview: false })
  })
  it('las señales salen ordenadas de más a menos grave', () => {
    const e = ev({ ageYears: 80, weightKg: 45 }, { kcal: 900, bmr: 1300, carbsG: 30, remainingKcalForCarbs: 100 })
    const order = { bloqueo: 3, revision: 2, advertencia: 1, info: 0 }
    const sev = e.signals.map(s => order[s.severity])
    expect(sev).toEqual([...sev].sort((a, b) => b - a))
  })
  it('ningún texto de ninguna señal promete seguridad ni habla de «límite seguro»', () => {
    const FORBIDDEN = /l[ií]mite seguro|es seguro|son seguros|garantiz|m[ií]nimo seguro|libre de riesgo/i
    const casos: [Partial<SafetyProfile>, Parameters<typeof evaluatePlanSafety>[1]][] = [
      [{ ageYears: 10 }, null], [{ sex: null }, null], [{ reproductiveStatus: 'embarazo', losingWeight: true }, null], [{ reproductiveStatus: 'lactancia' }, { kcal: 1800 }],
      [{ weightKg: 40, losingWeight: true }, { kcal: 900, bmr: 1200, carbsG: 20 }], [{}, { kcal: 1800, remainingKcalForCarbs: -50 }], [{ ageYears: 85 }, null],
      [{ heightCm: 1.65 }, null], [{ birthDate: '2030-01-01' }, null], [{ ageYears: 40, birthDate: '1980-05-05' }, { kcal: 1500, proteinG: 200, carbsG: 300, fatG: 100 }],
    ]
    for (const [p, plan] of casos) for (const s of ev(p, plan).signals) expect(`${s.title} ${s.explanation}`, s.code).not.toMatch(FORBIDDEN)
  })
})

describe('sexo: nunca se asume', () => {
  it('sin sexo, Mifflin y Harris bloquean; Katch-McArdle no lo necesita', () => {
    for (const formula of ['mifflin', 'harris'] as const) {
      const e = ev({ sex: null, formula })
      expect(codes(e)).toContain('SEXO_NO_INFORMADO')
      expect(e.blocked).toBe(true)
    }
    expect(codes(ev({ sex: null, formula: 'katch', bodyFatPct: 20 }))).not.toContain('SEXO_NO_INFORMADO')
  })
  it('en el reajuste (no estricto) la falta de sexo no bloquea', () => {
    expect(ev({ sex: null }, null, { strict: false }).blocked).toBe(false)
  })
  it('sexFromGender solo reconoce palabras completas e inequívocas', () => {
    expect(sexFromGender('Mujer')).toBe('mujer')
    expect(sexFromGender('  femenino ')).toBe('mujer')
    expect(sexFromGender('Female')).toBe('mujer')
    expect(sexFromGender('Hombre')).toBe('hombre')
    expect(sexFromGender('Varón')).toBe('hombre')
    expect(sexFromGender('masculino')).toBe('hombre')
    for (const raro of ['F', 'M', 'f', 'm', 'No binario', 'otro', 'prefiero no decirlo', '', '   ', null, undefined, 'mujer trans', 'hombre/mujer']) expect(sexFromGender(raro as string), String(raro)).toBeNull()
  })
})

describe('edad y población', () => {
  it('bloquea a los menores de 18 años, sea cual sea la edad', () => {
    for (const age of [0, 3, 5, 10, 12, 15, 16, 17, 17.9]) {
      const e = ev({ ageYears: age })
      expect(codes(e), String(age)).toContain('MENOR_DE_EDAD')
      expect(e.blocked).toBe(true)
    }
  })
  it('con exactamente 18 años no es menor; avisa de que está fuera de la muestra de Mifflin (19–78)', () => {
    const e = ev({ ageYears: 18 })
    expect(codes(e)).not.toContain('MENOR_DE_EDAD')
    expect(codes(e)).toContain('EDAD_FUERA_DE_MUESTRA')
    expect(e.blocked).toBe(false)
  })
  it('la muestra de Mifflin: 19 y 78 años no avisan; 79 sí; con Harris o Katch no se avisa por esto', () => {
    expect(codes(ev({ ageYears: 19 }))).not.toContain('EDAD_FUERA_DE_MUESTRA')
    expect(codes(ev({ ageYears: 78 }))).not.toContain('EDAD_FUERA_DE_MUESTRA')
    expect(codes(ev({ ageYears: 79 }))).toContain('EDAD_FUERA_DE_MUESTRA')
    expect(codes(ev({ ageYears: 79, formula: 'harris' }))).not.toContain('EDAD_FUERA_DE_MUESTRA')
  })
  it('edad ausente: bloquea en la calculadora y es solo información en el reajuste', () => {
    for (const age of [null, NaN]) {
      expect(codes(ev({ ageYears: age as number | null }))).toContain('EDAD_AUSENTE')
      expect(ev({ ageYears: age as number | null }).blocked).toBe(true)
      const soft = ev({ ageYears: age as number | null }, null, { strict: false })
      expect(codes(soft)).toEqual(expect.arrayContaining(['EDAD_NO_CONSTA']))
      expect(soft.blocked).toBe(false)
    }
  })
  it('edades imposibles se bloquean como dato inverosímil (negativa, 111, 200) y las muy altas pero posibles solo avisan', () => {
    for (const age of [-1, 111, 200]) expect(codes(ev({ ageYears: age })), String(age)).toContain('DATO_INVEROSIMIL')
    const e = ev({ ageYears: 101 })
    expect(codes(e)).toContain('DATO_INUSUAL')
    expect(e.blocked).toBe(false)
    expect(INPUT_RANGES.ageYears.hard).toEqual([0, 110])
  })
  it('fecha de nacimiento: futura bloquea; la edad escrita debe ser coherente con ella', () => {
    const futura = ev({ ageYears: 30, birthDate: '2027-02-01' })
    expect(codes(futura)).toEqual(['FECHA_NACIMIENTO_INVALIDA'])
    expect(futura.blocked).toBe(true)
    expect(ev({ ageYears: 30, birthDate: '1996-03-01' }).signals).toEqual([])
    const incoherente = ev({ ageYears: 40, birthDate: '1996-03-01' })
    expect(codes(incoherente)).toContain('EDAD_INCOHERENTE')
    expect(find(incoherente, 'EDAD_INCOHERENTE')!.evidence).toMatchObject({ edadEscrita: 40, edadPorFecha: 30 })
    expect(incoherente.blocked).toBe(false)
    expect(codes(ev({ ageYears: 30, birthDate: 'no-es-fecha' }))).toContain('FECHA_NACIMIENTO_INVALIDA')
  })
  it('ageFromBirthDate: cumpleaños, fecha futura y fechas inválidas', () => {
    expect(ageFromBirthDate('2008-11-18', TODAY)).toBe(18)
    expect(ageFromBirthDate('2008-11-19', TODAY)).toBe(17)
    expect(ageFromBirthDate('2027-01-01', TODAY)).toBeLessThan(0)
    expect(ageFromBirthDate('xx', TODAY)).toBeNull()
    expect(ageFromBirthDate(null, TODAY)).toBeNull()
    expect(ageFromBirthDate('', TODAY)).toBeNull()
  })
})

describe('embarazo y lactancia (solo con información estructurada)', () => {
  it('con déficit: bloquea el objetivo de pérdida de peso', () => {
    for (const estado of ['embarazo', 'lactancia'] as const) {
      const e = ev({ reproductiveStatus: estado, losingWeight: true })
      expect(codes(e)).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
      expect(e.blocked).toBe(true)
      expect(find(e, 'EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')!.evidence).toEqual({ estado })
    }
  })
  it('sin déficit: se puede calcular pero pide revisión profesional', () => {
    for (const estado of ['embarazo', 'lactancia'] as const) {
      const e = ev({ reproductiveStatus: estado, losingWeight: false })
      expect(codes(e)).toEqual(['EMBARAZO_LACTANCIA_REVISION'])
      expect(e).toMatchObject({ level: 'revision', blocked: false, needsProfessionalReview: true })
    }
  })
  it('«no»: sin señal; «no consta» en una mujer adulta: solo una nota informativa', () => {
    expect(ev({ reproductiveStatus: 'ninguno' }).signals).toEqual([])
    for (const s of ['no_consta', null, undefined] as const) {
      const e = ev({ reproductiveStatus: s as never })
      expect(codes(e)).toEqual(['EMBARAZO_LACTANCIA_NO_CONSTA'])
      expect(e.level).toBe('ok') // una nota informativa no sube el nivel
    }
    expect(codes(ev({ sex: 'hombre', reproductiveStatus: 'no_consta' }))).toEqual([])
  })
  it('reproductiveStatusFromAnswer interpreta las opciones del cuestionario', () => {
    expect(reproductiveStatusFromAnswer('Embarazo')).toBe('embarazo')
    expect(reproductiveStatusFromAnswer('Lactancia')).toBe('lactancia')
    expect(reproductiveStatusFromAnswer('No (o no aplica)')).toBe('ninguno')
    expect(reproductiveStatusFromAnswer('No')).toBe('ninguno')
    for (const raro of ['Prefiero comentarlo con mi profesional', '', undefined, null, 'quizá', 'Nose']) expect(reproductiveStatusFromAnswer(raro as string), String(raro)).toBe('no_consta')
    expect(isReproductiveActive('embarazo')).toBe(true)
    expect(isReproductiveActive('lactancia')).toBe(true)
    expect(isReproductiveActive('ninguno')).toBe(false)
    expect(isReproductiveActive('no_consta')).toBe(false)
  })
})

describe('datos ausentes, inválidos y extremos', () => {
  it('peso, altura y edad ausentes o NaN bloquean con su propio código', () => {
    expect(codes(ev({ weightKg: null }))).toContain('PESO_AUSENTE')
    expect(codes(ev({ weightKg: NaN }))).toContain('PESO_AUSENTE')
    expect(codes(ev({ weightKg: 0 }))).toContain('PESO_AUSENTE')
    expect(codes(ev({ weightKg: -50 }))).toContain('PESO_AUSENTE')
    expect(codes(ev({ heightCm: null }))).toContain('ALTURA_AUSENTE')
    expect(codes(ev({ heightCm: 0 }))).toContain('ALTURA_AUSENTE')
  })
  it('rangos de verosimilitud: lo imposible bloquea y lo raro avisa', () => {
    const casos: [Partial<SafetyProfile>, SignalCode, boolean][] = [
      [{ heightCm: 1.65 }, 'DATO_INVEROSIMIL', true], [{ heightCm: 1 }, 'DATO_INVEROSIMIL', true], [{ heightCm: 400 }, 'DATO_INVEROSIMIL', true],
      [{ heightCm: 130 }, 'DATO_INUSUAL', false], [{ heightCm: 215 }, 'DATO_INUSUAL', false],
      [{ weightKg: 20 }, 'DATO_INVEROSIMIL', true], [{ weightKg: 500 }, 'DATO_INVEROSIMIL', true],
      [{ weightKg: 35 }, 'DATO_INUSUAL', false], [{ weightKg: 300 }, 'DATO_INUSUAL', false], [{ weightKg: 400 }, 'DATO_INUSUAL', false],
    ]
    for (const [p, code, bloquea] of casos) {
      const e = ev(p)
      expect(codes(e), JSON.stringify(p)).toContain(code)
      expect(e.blocked, JSON.stringify(p)).toBe(bloquea)
    }
  })
  it('Katch-McArdle: necesita un % de grasa entre 0 y 100; fuera de lo verosímil bloquea y lo raro avisa', () => {
    const k = (bf: number | null | undefined) => ev({ formula: 'katch', bodyFatPct: bf as number })
    for (const bf of [undefined, null, 0, -5, 100, 120, NaN]) { expect(codes(k(bf as number)), String(bf)).toContain('GRASA_AUSENTE'); expect(k(bf as number).blocked).toBe(true) }
    expect(codes(k(99))).toContain('DATO_INVEROSIMIL')
    expect(codes(k(1))).toContain('DATO_INVEROSIMIL')
    expect(codes(k(3))).toContain('DATO_INUSUAL')
    expect(k(3).blocked).toBe(false)
    expect(k(22).signals).toEqual([])
    // con Mifflin el % de grasa no se pide
    expect(codes(ev({ formula: 'mifflin', bodyFatPct: undefined }))).not.toContain('GRASA_AUSENTE')
  })
})

describe('IMC bajo (señal contextual en adultos)', () => {
  it('con IMC < 18,5: aviso sin déficit y revisión con objetivo de pérdida', () => {
    const sinDeficit = ev({ weightKg: 45, heightCm: 160, losingWeight: false })
    expect(find(sinDeficit, 'IMC_BAJO')).toMatchObject({ severity: 'advertencia', basis: 'evidencia_limitada' })
    expect(find(sinDeficit, 'IMC_BAJO')!.evidence).toMatchObject({ imc: 17.6, umbral: 18.5 })
    const conDeficit = ev({ weightKg: 45, heightCm: 160, losingWeight: true })
    expect(find(conDeficit, 'IMC_BAJO')!.severity).toBe('revision')
    expect(conDeficit.blocked).toBe(false)
  })
  it('no es un diagnóstico: el texto lo dice, y con IMC normal o alto no hay señal', () => {
    expect(find(ev({ weightKg: 45, heightCm: 160 }), 'IMC_BAJO')!.explanation).toMatch(/no es un diagn[oó]stico/i)
    expect(codes(ev({ weightKg: 65, heightCm: 165 }))).not.toContain('IMC_BAJO')
    expect(codes(ev({ weightKg: 120, heightCm: 165 }))).not.toContain('IMC_BAJO')
  })
  it('es configurable', () => {
    expect(codes(ev({ weightKg: 45, heightCm: 160 }, null, { thresholds: { bmiLow: 17 } }))).not.toContain('IMC_BAJO')
  })
  it('no se evalúa en menores (ya están bloqueados)', () => {
    expect(codes(ev({ ageYears: 15, weightKg: 35, heightCm: 150 }))).not.toContain('IMC_BAJO')
  })
})

describe('objetivo energético: umbral de revisión y TMB', () => {
  it('1.200 kcal es un UMBRAL DE REVISIÓN, no un mínimo: por debajo pide revisión, por encima no dice nada', () => {
    const bajo = ev({}, { kcal: 1100 })
    const s = find(bajo, 'OBJETIVO_BAJO_UMBRAL')!
    expect(s).toMatchObject({ severity: 'revision', basis: 'decision_de_producto' })
    expect(s.explanation).toMatch(/NO es un m[ií]nimo de seguridad/)
    expect(s.explanation).toMatch(/provisional y configurable/)
    expect(bajo.needsProfessionalReview).toBe(true)
    expect(bajo.blocked).toBe(false) // pedir revisión no es bloquear
    expect(codes(ev({}, { kcal: 1200 }))).not.toContain('OBJETIVO_BAJO_UMBRAL')
    expect(codes(ev({}, { kcal: 2500 }))).toEqual([])
    expect(DEFAULT_REVIEW_THRESHOLDS.minKcalReview).toBe(1200)
  })
  it('el umbral es configurable y no hay valores universales', () => {
    expect(codes(ev({}, { kcal: 1100 }, { thresholds: { minKcalReview: 1000 } }))).not.toContain('OBJETIVO_BAJO_UMBRAL')
    expect(codes(ev({}, { kcal: 1400 }, { thresholds: { minKcalReview: 1500 } }))).toContain('OBJETIVO_BAJO_UMBRAL')
    expect(find(ev({}, { kcal: 1400 }, { thresholds: { minKcalReview: 1500 } }), 'OBJETIVO_BAJO_UMBRAL')!.evidence).toMatchObject({ kcal: 1400, umbral: 1500 })
  })
  it('objetivo por debajo de la TMB estimada: revisión, con la proporción como evidencia y el margen de error de la estimación', () => {
    const e = ev({}, { kcal: 1100, bmr: 1189 })
    const s = find(e, 'OBJETIVO_BAJO_TMB')!
    expect(s).toMatchObject({ severity: 'revision', basis: 'evidencia_limitada' })
    expect(s.evidence).toMatchObject({ kcal: 1100, tmbEstimada: 1189, proporcion: 0.93 })
    expect(s.explanation).toMatch(/margen de error/)
    expect(codes(ev({}, { kcal: 1300, bmr: 1189 }))).not.toContain('OBJETIVO_BAJO_TMB')
    expect(codes(ev({}, { kcal: 1189, bmr: 1189 }))).not.toContain('OBJETIVO_BAJO_TMB') // igual no es «inferior»
    expect(codes(ev({}, { kcal: 1100 }))).not.toContain('OBJETIVO_BAJO_TMB') // sin TMB no hay comparación
  })
  it('puede darse una señal sin la otra: 1.300 kcal con TMB 1.500 → solo TMB; 1.100 con TMB 900 → solo umbral', () => {
    expect(codes(ev({}, { kcal: 1300, bmr: 1500 }))).toEqual(['OBJETIVO_BAJO_TMB'])
    expect(codes(ev({}, { kcal: 1100, bmr: 900 }))).toEqual(['OBJETIVO_BAJO_UMBRAL'])
  })
  it('el factor de la TMB es configurable', () => {
    expect(codes(ev({}, { kcal: 1250, bmr: 1189 }, { thresholds: { bmrRatioReview: 1.1 } }))).toContain('OBJETIVO_BAJO_TMB')
  })
  it('si el perfil bloquea el cálculo no se evalúa el plan', () => {
    expect(codes(ev({ ageYears: 12 }, { kcal: 500, bmr: 900 }))).toEqual(['MENOR_DE_EDAD'])
  })
})

describe('macros', () => {
  it('proteína + grasa por encima del objetivo: BLOQUEA (no se recorta a 0 en silencio) y dice cuánto falta', () => {
    const e = ev({}, { kcal: 1141, proteinG: 150, fatG: 100, carbsG: 0, remainingKcalForCarbs: -359 })
    const s = find(e, 'MACROS_INCOMPATIBLES')!
    expect(s).toMatchObject({ severity: 'bloqueo', basis: 'aritmetica' })
    expect(s.evidence).toMatchObject({ kcal: 1141, kcalProteinaMasGrasa: 1500, exceso: 359 })
    expect(e.blocked).toBe(true)
    expect(codes(e)).not.toContain('CARBOHIDRATOS_BAJOS') // no se añade un segundo aviso sobre un reparto ya inválido
  })
  it('hidratos bajo el umbral de aviso: advertencia (decisión de producto), no bloqueo', () => {
    const e = ev({}, { kcal: 1800, carbsG: 30, remainingKcalForCarbs: 120 })
    expect(find(e, 'CARBOHIDRATOS_BAJOS')).toMatchObject({ severity: 'advertencia', basis: 'decision_de_producto' })
    expect(e.blocked).toBe(false)
    expect(codes(ev({}, { kcal: 1800, carbsG: 50, remainingKcalForCarbs: 120 }))).not.toContain('CARBOHIDRATOS_BAJOS')
  })
  it('planes escritos a mano: avisa si las kcal no cuadran con los macros (más del 5 %)', () => {
    const cuadra = ev({}, { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 67 })
    expect(codes(cuadra)).not.toContain('MACROS_NO_CUADRAN') // 600+800+603 = 2003
    const noCuadra = ev({}, { kcal: 2000, proteinG: 150, carbsG: 300, fatG: 100 })
    expect(find(noCuadra, 'MACROS_NO_CUADRAN')).toMatchObject({ severity: 'advertencia', basis: 'aritmetica' })
    expect(find(noCuadra, 'MACROS_NO_CUADRAN')!.evidence).toMatchObject({ kcal: 2000, kcalDeMacros: 2700, diferencia: 700 })
    // sin los tres macros no se comprueba
    expect(codes(ev({}, { kcal: 2000, proteinG: 150 }))).not.toContain('MACROS_NO_CUADRAN')
    expect(codes(ev({}, { kcal: 2000, proteinG: 150, carbsG: 300, fatG: 100 }, { checkMacroSum: false }))).not.toContain('MACROS_NO_CUADRAN')
  })
})

describe('niveles y utilidades', () => {
  it('el nivel es el de la señal más grave y las informativas no lo suben', () => {
    expect(ev({ ageYears: 12 }).level).toBe('bloqueo')
    expect(ev({}, { kcal: 1100 }).level).toBe('revision')
    expect(ev({ weightKg: 35 }).level).toBe('advertencia')
    expect(ev({ reproductiveStatus: 'no_consta' }).level).toBe('ok')
  })
  it('visibleSignals oculta solo las meramente informativas', () => {
    const e = ev({ reproductiveStatus: 'no_consta', weightKg: 35 })
    expect(codes(e)).toContain('EMBARAZO_LACTANCIA_NO_CONSTA')
    expect(visibleSignals(e).map(s => s.code).sort()).toEqual(['DATO_INUSUAL', 'IMC_BAJO'])
  })
  it('es determinista y no modifica la entrada', () => {
    const p: SafetyProfile = { ...adult, weightKg: 40 }
    const plan = { kcal: 1000, bmr: 1200 }
    const copiaP = JSON.stringify(p), copiaPlan = JSON.stringify(plan)
    const a = evaluatePlanSafety(p, plan, { today: TODAY })
    const b = evaluatePlanSafety(p, plan, { today: TODAY })
    expect(a).toEqual(b)
    expect(JSON.stringify(p)).toBe(copiaP)
    expect(JSON.stringify(plan)).toBe(copiaPlan)
  })
})
