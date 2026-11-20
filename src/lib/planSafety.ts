// Motor común de evaluación de seguridad y coherencia de un plan energético. Lo usan la calculadora metabólica y el reajuste.
//
// Qué es y qué NO es:
//  · Separa tres cosas: CALCULAR (siempre que los datos valgan), ADVERTIR (señales visibles junto al resultado) y pedir VALIDACIÓN
//    PROFESIONAL (el profesional confirma de forma explícita un objetivo que el motor pide revisar). Solo BLOQUEA lo que no se puede
//    calcular con sentido: datos ausentes o imposibles, ecuaciones de adultos aplicadas a menores, pérdida de peso automática en
//    embarazo o lactancia, y reparto de macros matemáticamente incompatible.
//  · NO hay un mínimo universal de calorías. Los 1.200 kcal son un UMBRAL DE REVISIÓN interno, provisional y configurable: por debajo
//    se pide revisión, no se afirma que por encima sea «seguro». Ninguna señal es un diagnóstico ni una garantía.
//  · Cada señal dice en qué se apoya (`basis`): aritmética, evidencia sólida, evidencia limitada o decisión de producto. No se inventan
//    umbrales clínicos: los números que no vienen de una fuente se rotulan como decisión de producto, con su justificación en
//    docs/calculadora-metabolica.md.
//
// Lógica pura: sin React ni red.

export type SexValue = 'hombre' | 'mujer'
/** Estado reproductivo declarado. `no_consta` = no se sabe (no es lo mismo que «no»). */
export type ReproductiveStatus = 'ninguno' | 'embarazo' | 'lactancia' | 'no_consta'
export type SignalSeverity = 'info' | 'advertencia' | 'revision' | 'bloqueo'
export type EvidenceBasis = 'aritmetica' | 'evidencia_solida' | 'evidencia_limitada' | 'decision_de_producto'
export type EvaluationLevel = 'ok' | 'advertencia' | 'revision' | 'bloqueo'
export type CalculatorFormula = 'mifflin' | 'harris' | 'katch'
/** Estado de la lectura del cuestionario de salud: cargando, leído (aunque no haya respuesta) o fallo de la consulta. */
export type ReproductiveCheck = 'ready' | 'loading' | 'error'

export type SignalCode =
  | 'SEXO_NO_INFORMADO'
  | 'EDAD_AUSENTE'
  | 'EDAD_NO_CONSTA'
  | 'FECHA_NACIMIENTO_INVALIDA'
  | 'EDAD_INCOHERENTE'
  | 'EDAD_FUERA_DE_MUESTRA'
  | 'MENOR_DE_EDAD'
  | 'PESO_AUSENTE'
  | 'ALTURA_AUSENTE'
  | 'GRASA_AUSENTE'
  | 'DATO_INVEROSIMIL'
  | 'DATO_INUSUAL'
  | 'DATO_INVALIDO'
  | 'EMBARAZO_LACTANCIA_PERDIDA_DE_PESO'
  | 'EMBARAZO_LACTANCIA_REVISION'
  | 'EMBARAZO_LACTANCIA_NO_CONSTA'
  | 'IMC_BAJO'
  | 'OBJETIVO_BAJO_TMB'
  | 'OBJETIVO_BAJO_UMBRAL'
  | 'CARBOHIDRATOS_BAJOS'
  | 'MACROS_INCOMPATIBLES'
  | 'MACROS_NO_CUADRAN'
  | 'MACROS_REDONDEO'
  | 'ANAMNESIS_NO_COMPROBADA'

export interface PlanSignal {
  code: SignalCode
  severity: SignalSeverity
  basis: EvidenceBasis
  /** Frase corta para la pantalla. */
  title: string
  /** Qué significa y qué hacer, sin prometer seguridad. */
  explanation: string
  /** Los datos concretos que han disparado la señal (para mostrarlos y para las pruebas). */
  evidence: Record<string, string | number | boolean | null>
}

export interface PlanEvaluation {
  /** Nivel más alto entre las señales (las de severidad `info` no suben el nivel). */
  level: EvaluationLevel
  signals: PlanSignal[]
  /** Hay al menos una señal de bloqueo: no se debe presentar un resultado como aplicable. */
  blocked: boolean
  /** Hay señales de revisión: el profesional debe confirmar de forma explícita antes de aplicar. */
  needsProfessionalReview: boolean
  /**
   * Hay algo que la app NO puede determinar y que exige una evaluación profesional ESPECÍFICA (no basta la casilla genérica de revisión):
   * hoy, embarazo o lactancia con un objetivo del que no se sabe si implica pérdida de peso.
   */
  needsSpecificProfessionalEvaluation: boolean
}

/**
 * Umbrales configurables. Todos son decisiones de producto salvo `bmiLow` (clasificación de la OMS para adultos, que se usa solo como
 * señal contextual). Se pueden sobrescribir por llamada; no hay valor «universal».
 */
export interface ReviewThresholds {
  /** Por debajo de estas kcal se pide revisión. Provisional (heredado del reajuste, 1.200); NO es un mínimo de seguridad. */
  minKcalReview: number
  /** Por debajo de estos gramos de hidratos se avisa. Decisión de producto heredada del reajuste. */
  minCarbsG: number
  /** Objetivo por debajo de TMB × este factor → revisión. 1 = objetivo inferior a la TMB estimada. */
  bmrRatioReview: number
  /** IMC (kg/m²) por debajo del cual se avisa en adultos. Clasificación de bajo peso de la OMS; señal contextual, no diagnóstico. */
  bmiLow: number
  /**
   * Tolerancia de INCOHERENCIA ENERGÉTICA (en %): cuánto pueden quedarse POR DEBAJO las kcal que suman los macros respecto al objetivo antes
   * de avisar. 3 % = el mismo criterio de la pantalla del plan («Reparto: x % de las kcal (no suma 100)»). Decisión de producto.
   */
  macroTolerancePct: number
  /**
   * Tolerancia de REDONDEO (absoluta, en kcal): los gramos se enseñan enteros, así que la suma de lo que ves puede diferir del objetivo.
   * Por encima del objetivo, hasta esta cifra es redondeo (nota informativa); más allá ya es una incoherencia (aviso).
   */
  macroRoundingKcal: number
}

/**
 * Cota teórica del redondeo a gramos enteros: medio gramo de proteína (2 kcal) + medio de hidratos (2) + medio de grasa (4,5) + media kcal
 * del objetivo redondeado = 9 kcal. Es aritmética, no una decisión clínica.
 */
export const MACRO_ROUNDING_TOLERANCE_KCAL = 9

export const DEFAULT_REVIEW_THRESHOLDS: ReviewThresholds = {
  minKcalReview: 1200,
  minCarbsG: 50,
  bmrRatioReview: 1,
  bmiLow: 18.5,
  macroTolerancePct: 3,
  macroRoundingKcal: MACRO_ROUNDING_TOLERANCE_KCAL,
}

/**
 * Rangos de VALIDACIÓN DE ENTRADA (decisión de producto, no umbrales clínicos): `hard` = casi seguro un error de escritura (se bloquea);
 * `soft` = posible pero poco habitual (se avisa). Sirven para pillar «1,65» escrito en el campo de centímetros o una edad de 200 años.
 */
export const INPUT_RANGES = {
  ageYears: { hard: [0, 110], soft: [18, 100] },
  weightKg: { hard: [30, 400], soft: [40, 250] },
  heightCm: { hard: [100, 250], soft: [140, 210] },
  bodyFatPct: { hard: [2, 70], soft: [5, 50] },
} as const

/** Mayoría de edad: las ecuaciones de adultos de la app no se aplican por debajo. */
export const ADULT_AGE = 18
/** Muestra de la que salió Mifflin-St Jeor (Mifflin 1990: 498 personas de 19 a 78 años). */
export const MIFFLIN_SAMPLE_AGE: readonly [number, number] = [19, 78]

const SEVERITY_ORDER: Record<SignalSeverity, number> = { bloqueo: 3, revision: 2, advertencia: 1, info: 0 }

// ── Utilidades de datos ─────────────────────────────────────────────────────────────────────────────

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Edad en años cumplidos a una fecha. `null` si no hay fecha o no se entiende. Una fecha futura devuelve un valor negativo
 * (el que llama decide: aquí se trata como fecha inválida).
 */
export function ageFromBirthDate(birthDate: string | null | undefined, referenceDate = new Date()): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  let age = referenceDate.getFullYear() - birth.getFullYear()
  const monthDiff = referenceDate.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) age--
  return age
}

/**
 * Sexo a partir del texto libre de la ficha. Solo se reconocen palabras completas e inequívocas; una sola letra («M», «F»),
 * «No binario», vacío o cualquier otra cosa devuelve `null`: NO se asume un sexo por defecto.
 */
export function sexFromGender(gender: string | null | undefined): SexValue | null {
  if (!gender) return null
  const g = fold(gender)
  if (/^(mujer|femenino|femenina|hembra|female|woman)$/.test(g)) return 'mujer'
  if (/^(hombre|masculino|varon|macho|male|man)$/.test(g)) return 'hombre'
  return null
}

/** Respuesta del cuestionario de salud («embarazo_lactancia») → estado estructurado. Lo que no se reconoce es `no_consta`. */
export function reproductiveStatusFromAnswer(answer: string | null | undefined): ReproductiveStatus {
  if (!answer) return 'no_consta'
  const a = fold(answer)
  if (a.startsWith('embarazo')) return 'embarazo'
  if (a.startsWith('lactancia')) return 'lactancia'
  if (a.startsWith('no ')) return 'ninguno' // «No (o no aplica)»
  if (a === 'no') return 'ninguno'
  return 'no_consta'
}

/**
 * Resultado de leer la fila de `anamnesis`: sin fila (el cliente no la ha rellenado) es `ready` con respuesta vacía; un error de consulta
 * es `error` y NO se confunde con «no consta».
 */
export function reproductiveCheckFromQuery(data: { answers?: Record<string, string> | null } | null | undefined, error: unknown): { check: ReproductiveCheck; answer: string } {
  if (error) return { check: 'error', answer: '' }
  return { check: 'ready', answer: data?.answers?.embarazo_lactancia ?? '' }
}

/** La señal de que no se ha podido comprobar el embarazo o la lactancia (para el reajuste, que no puede continuar sin saberlo). */
export function reproductiveUnverifiedSignal(check: 'loading' | 'error', severity: SignalSeverity = check === 'loading' ? 'bloqueo' : 'revision'): PlanSignal {
  return check === 'loading'
    ? signal('ANAMNESIS_NO_COMPROBADA', severity, 'aritmetica', 'Comprobando el cuestionario de salud…',
      'Todavía no se ha leído si hay embarazo o lactancia. Espera un momento.', { estado: 'cargando' })
    : signal('ANAMNESIS_NO_COMPROBADA', severity, 'decision_de_producto', 'No se ha podido comprobar el embarazo o la lactancia',
      'Ha fallado la lectura del cuestionario de salud. Eso NO significa que no haya embarazo ni lactancia: confírmalo con el cliente y vuelve a intentarlo antes de aplicar nada.', { estado: 'error' })
}

export const isReproductiveActive = (s: ReproductiveStatus | null | undefined) => s === 'embarazo' || s === 'lactancia'

// ── Entrada del motor ────────────────────────────────────────────────────────────────────────────────

export interface SafetyProfile {
  sex: SexValue | null
  /** Edad tal como se va a usar (la escrita o la derivada de la fecha de nacimiento). */
  ageYears: number | null
  /** Si consta, se comprueba que la edad escrita sea coherente con ella. */
  birthDate?: string | null
  weightKg?: number | null
  heightCm?: number | null
  bodyFatPct?: number | null
  formula?: CalculatorFormula
  /** El objetivo es perder peso (déficit). */
  losingWeight?: boolean
  /**
   * Una pérdida de peso es POSIBLE aunque el objetivo de la ficha no lo diga: la ficha no tiene objetivo (o es texto libre), o el objetivo
   * energético queda por debajo del mantenimiento estimado. Solo se usa en embarazo y lactancia: ahí la duda se resuelve en contra (bloqueo),
   * para que dejar vacío o cambiar el objetivo de la ficha no permita eludir la comprobación.
   */
  weightLossLikely?: boolean
  reproductiveStatus?: ReproductiveStatus | null
  /**
   * Si la información de embarazo/lactancia no se ha podido comprobar: `loading` bloquea y `error` pide revisión. Un error de lectura
   * NUNCA se interpreta como «no hay embarazo ni lactancia». `undefined` = no aplica (la persona lo ha indicado a mano, o no se usa).
   */
  reproductiveCheck?: ReproductiveCheck
}

export interface SafetyPlan {
  kcal?: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  /** TMB estimada con la que comparar el objetivo (si se conoce). */
  bmr?: number | null
  /** kcal que quedan para hidratos tras proteína y grasa, SIN recortar (negativo = proteína + grasa ya exceden el objetivo). */
  remainingKcalForCarbs?: number | null
}

export interface EvaluateOptions {
  thresholds?: Partial<ReviewThresholds>
  /**
   * `true` (calculadora): un dato que falta o es imposible BLOQUEA el cálculo. `false` (reajuste): lo que falta solo se anota como
   * información, porque el reajuste no necesita esos datos para funcionar.
   */
  strict?: boolean
  /** Comprobar que las kcal del objetivo cuadran con los macros (planes escritos a mano). Por defecto, solo si están todos. */
  checkMacroSum?: boolean
  /** Fecha de referencia para la edad (pruebas). */
  today?: Date
}

const r1 = (n: number) => Math.round(n * 10) / 10
/** Para los textos: un decimal y coma ("17,6"). */
const num = (n: number) => String(r1(n)).replace('.', ',')
const fmtKcal = (n: number) => Math.round(n).toLocaleString('es-ES')

function signal(code: SignalCode, severity: SignalSeverity, basis: EvidenceBasis, title: string, explanation: string, evidence: PlanSignal['evidence'] = {}): PlanSignal {
  return { code, severity, basis, title, explanation, evidence }
}

/** Para datos que no son un número válido o un valor conocido (p. ej. un nivel de actividad desconocido). */
export function invalidFieldSignal(field: string, value: unknown): PlanSignal {
  return signal('DATO_INVALIDO', 'bloqueo', 'aritmetica', `Dato no válido: ${field}`,
    `«${field}» no tiene un valor que la calculadora entienda, así que no se calcula nada con él.`, { campo: field, valor: String(value) })
}

type RangeKey = keyof typeof INPUT_RANGES
const LABELS: Record<RangeKey, { nombre: string; unidad: string }> = {
  ageYears: { nombre: 'edad', unidad: 'años' },
  weightKg: { nombre: 'peso', unidad: 'kg' },
  heightCm: { nombre: 'altura', unidad: 'cm' },
  bodyFatPct: { nombre: '% de grasa corporal', unidad: '%' },
}

function rangeSignal(key: RangeKey, value: number): PlanSignal | null {
  const { hard, soft } = INPUT_RANGES[key]
  const { nombre, unidad } = LABELS[key]
  if (value < hard[0] || value > hard[1]) {
    return signal('DATO_INVEROSIMIL', 'bloqueo', 'decision_de_producto', `La ${nombre} no es verosímil`,
      `${value} ${unidad} queda fuera de lo que se acepta como dato real (${hard[0]}–${hard[1]} ${unidad}). Suele ser un error de escritura (por ejemplo, metros en vez de centímetros): corrígelo para calcular.`,
      { campo: key, valor: value, minimo: hard[0], maximo: hard[1] })
  }
  if (value < soft[0] || value > soft[1]) {
    return signal('DATO_INUSUAL', 'advertencia', 'decision_de_producto', `La ${nombre} es poco habitual`,
      `${value} ${unidad} es posible pero poco habitual (lo habitual aquí: ${soft[0]}–${soft[1]} ${unidad}). Comprueba que está bien escrito.`,
      { campo: key, valor: value, minimo: soft[0], maximo: soft[1] })
  }
  return null
}

function levelOf(signals: PlanSignal[]): EvaluationLevel {
  const max = signals.reduce((m, s) => Math.max(m, SEVERITY_ORDER[s.severity]), 0)
  return max >= 3 ? 'bloqueo' : max === 2 ? 'revision' : max === 1 ? 'advertencia' : 'ok'
}

/** Evalúa el perfil de la persona y, si se pasa, el plan energético. Es determinista y no modifica nada. */
export function evaluatePlanSafety(profile: SafetyProfile, plan: SafetyPlan | null = null, options: EvaluateOptions = {}): PlanEvaluation {
  const th: ReviewThresholds = { ...DEFAULT_REVIEW_THRESHOLDS, ...options.thresholds }
  const strict = options.strict ?? true
  const today = options.today ?? new Date()
  const out: PlanSignal[] = []
  const formula = profile.formula

  // ── Sexo ──
  const needsSex = formula === 'mifflin' || formula === 'harris'
  if (profile.sex == null && needsSex && strict) {
    out.push(signal('SEXO_NO_INFORMADO', 'bloqueo', 'aritmetica', 'Falta el sexo',
      'Mifflin-St Jeor y Harris-Benedict tienen una ecuación para cada sexo y la ficha no lo indica con claridad. No se asume uno: elígelo para calcular (Katch-McArdle no lo necesita).',
      { formula: formula ?? null }))
  }

  // ── Edad y población ──
  let age = profile.ageYears
  const fromBirth = ageFromBirthDate(profile.birthDate, today)
  let futureBirth = false
  if (profile.birthDate && fromBirth != null && fromBirth < 0) {
    out.push(signal('FECHA_NACIMIENTO_INVALIDA', strict ? 'bloqueo' : 'advertencia', 'aritmetica', 'La fecha de nacimiento es futura',
      `La fecha ${profile.birthDate} es posterior a hoy. Corrígela en el perfil del cliente.`, { fechaNacimiento: profile.birthDate }))
    age = null
    futureBirth = true
  } else if (profile.birthDate && fromBirth == null) {
    out.push(signal('FECHA_NACIMIENTO_INVALIDA', 'advertencia', 'aritmetica', 'No se entiende la fecha de nacimiento',
      'La fecha de nacimiento de la ficha no tiene un formato válido, así que no se puede comprobar la edad escrita.', { fechaNacimiento: profile.birthDate }))
  }
  if (!isNum(age)) {
    if (!futureBirth) out.push(strict
      ? signal('EDAD_AUSENTE', 'bloqueo', 'aritmetica', 'Falta la edad', 'Sin la edad no se puede elegir ni aplicar una ecuación. Escríbela o añade la fecha de nacimiento al perfil.', {})
      : signal('EDAD_NO_CONSTA', 'info', 'aritmetica', 'No consta la edad', 'No hay fecha de nacimiento en la ficha, así que no se puede comprobar si es menor de edad.', {}))
  } else if (age < ADULT_AGE) {
    if (age < 0 || age > INPUT_RANGES.ageYears.hard[1]) {
      const s = rangeSignal('ageYears', age)
      if (s) out.push(s)
    } else {
      out.push(signal('MENOR_DE_EDAD', 'bloqueo', 'decision_de_producto', 'Menor de 18 años: no se calcula',
        `Con ${num(age)} años las ecuaciones de adultos de esta calculadora no se usan: no se derivaron de menores (Mifflin-St Jeor se obtuvo en personas de ${MIFFLIN_SAMPLE_AGE[0]} a ${MIFFLIN_SAMPLE_AGE[1]} años) y en niños y adolescentes hay ecuaciones y referencias específicas que esta herramienta no implementa. Requiere valoración profesional.`,
        { edad: r1(age), mayoriaDeEdad: ADULT_AGE }))
    }
  } else {
    const s = rangeSignal('ageYears', age)
    if (s) out.push(s)
    else if (formula === 'mifflin' && (age < MIFFLIN_SAMPLE_AGE[0] || age > MIFFLIN_SAMPLE_AGE[1])) {
      out.push(signal('EDAD_FUERA_DE_MUESTRA', 'advertencia', 'evidencia_limitada', 'Edad fuera de la muestra de Mifflin-St Jeor',
        `La ecuación se obtuvo en personas de ${MIFFLIN_SAMPLE_AGE[0]} a ${MIFFLIN_SAMPLE_AGE[1]} años; con ${num(age)} no hay datos que respalden su exactitud. Tómala como orientación.`,
        { edad: r1(age), muestraMin: MIFFLIN_SAMPLE_AGE[0], muestraMax: MIFFLIN_SAMPLE_AGE[1] }))
    }
    if (fromBirth != null && fromBirth >= 0 && Math.abs(fromBirth - age) >= 1) {
      out.push(signal('EDAD_INCOHERENTE', 'advertencia', 'aritmetica', 'La edad no coincide con la fecha de nacimiento',
        `Has escrito ${num(age)} años y la fecha de nacimiento del perfil da ${fromBirth}. Revisa cuál es la correcta.`, { edadEscrita: r1(age), edadPorFecha: fromBirth }))
    }
  }

  // ── Embarazo y lactancia (solo con información estructurada) ──
  const reproductive = profile.reproductiveStatus ?? null
  if (isReproductiveActive(reproductive)) {
    const que = reproductive === 'embarazo' ? 'embarazo' : 'lactancia'
    if (profile.losingWeight || profile.weightLossLikely) {
      out.push(signal('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO', 'bloqueo', 'decision_de_producto', `En ${que} no se calcula un objetivo de pérdida de peso`,
        `Con ${que} declarado no se genera automáticamente un objetivo de déficit. Las necesidades energéticas cambian en esas etapas (EFSA 2013 les suma energía) y la pauta requiere valoración profesional.`,
        { estado: reproductive, objetivoPerdida: !!profile.losingWeight, perdidaProbable: !!profile.weightLossLikely }))
    } else {
      // NO se puede determinar si el objetivo implica pérdida de peso: queda PENDIENTE de evaluación profesional. Que las kcal superen TMB × 1,2
      // no lo descarta (con más actividad que la sedentaria se puede estar en déficit) y sin TMB (faltan datos) tampoco se puede comparar.
      out.push(signal('EMBARAZO_LACTANCIA_REVISION', 'revision', 'evidencia_limitada', `Pendiente de evaluación profesional: hay ${que}`,
        `Con ${que} declarado, la app no puede determinar si este objetivo implica una pérdida de peso: depende de la actividad real de la persona y, si faltan datos (sexo, edad, altura o peso), ni siquiera se puede estimar la TMB. Que las kcal superen TMB × 1,2 no demuestra que no haya déficit. Las ecuaciones de la app son para adultos sin ${que} y no incluyen su coste energético adicional (EFSA 2013 lo cifra aparte). Queda pendiente de una evaluación profesional específica; no es una validación de seguridad.`,
        { estado: reproductive, objetivoPerdida: false, perdidaProbable: false }))
    }
  } else if (profile.reproductiveCheck === 'loading' || profile.reproductiveCheck === 'error') {
    out.push(reproductiveUnverifiedSignal(profile.reproductiveCheck))
  } else if (typeof age === 'number' && age >= ADULT_AGE && (reproductive == null || reproductive === 'no_consta')) {
    // Para cualquier persona adulta, sin depender del sexo ni de la identidad de género declarados en la ficha.
    out.push(signal('EMBARAZO_LACTANCIA_NO_CONSTA', 'info', 'decision_de_producto', 'No consta si hay embarazo o lactancia (solo si te aplica)',
      'La calculadora no los contempla. Si pudieran darse, indícalo en el cuestionario de salud o en la propia calculadora.', { estado: reproductive ?? 'sin_dato' }))
  }

  // ── Peso, altura y grasa ──
  const w = profile.weightKg, h = profile.heightCm, bf = profile.bodyFatPct
  const checkValue = (key: RangeKey, value: number | null | undefined, missing: SignalCode, missingTitle: string, required: boolean) => {
    if (!isNum(value) || value <= 0) {
      if (strict && required) out.push(signal(missing, 'bloqueo', 'aritmetica', missingTitle, 'Hace falta este dato para calcular.', { campo: key }))
      return false
    }
    const s = rangeSignal(key, value)
    if (s) out.push(s)
    return s?.severity !== 'bloqueo'
  }
  const weightOk = checkValue('weightKg', w, 'PESO_AUSENTE', 'Falta el peso', true)
  const heightOk = checkValue('heightCm', h, 'ALTURA_AUSENTE', 'Falta la altura', true)
  if (formula === 'katch') {
    if (!isNum(bf) || bf <= 0 || bf >= 100) {
      if (strict) out.push(signal('GRASA_AUSENTE', 'bloqueo', 'aritmetica', 'Falta el % de grasa corporal', 'Katch-McArdle usa la masa magra: necesita un % de grasa entre 0 y 100.', { campo: 'bodyFatPct', valor: isNum(bf) ? bf : null }))
    } else {
      const s = rangeSignal('bodyFatPct', bf)
      if (s) out.push(s)
    }
  }

  // ── IMC bajo en adultos (señal contextual, no diagnóstico) ──
  if (isNum(age) && age >= ADULT_AGE && weightOk && heightOk && isNum(w) && isNum(h) && h > 0) {
    const bmi = w / (h / 100) ** 2
    if (bmi < th.bmiLow) {
      out.push(signal('IMC_BAJO', profile.losingWeight ? 'revision' : 'advertencia', 'evidencia_limitada', `IMC bajo (${num(bmi)})`,
        `Un IMC por debajo de ${th.bmiLow} se considera bajo peso en adultos (clasificación de la OMS). El IMC no es un diagnóstico (no distingue masa magra de grasa, ni la constitución) pero, con un objetivo de pérdida de peso, conviene valorarlo antes de aplicar un déficit.`,
        { imc: r1(bmi), umbral: th.bmiLow, objetivoPerdida: !!profile.losingWeight }))
    }
  }

  // Si el perfil ya impide calcular, no se evalúa el plan (no habría uno que valorar).
  if (out.some(s => s.severity === 'bloqueo') || !plan) return finish(out)

  // ── Plan energético ──
  const kcal = plan.kcal
  if (isNum(kcal) && kcal > 0) {
    if (isNum(plan.bmr) && plan.bmr > 0 && kcal < plan.bmr * th.bmrRatioReview) {
      out.push(signal('OBJETIVO_BAJO_TMB', 'revision', 'evidencia_limitada', 'Objetivo por debajo de la TMB estimada',
        `El objetivo (${fmtKcal(kcal)} kcal) es inferior a la TMB estimada (${fmtKcal(plan.bmr)} kcal). La TMB es una estimación con margen de error individual (en la revisión de Frankenfield 2005, Mifflin-St Jeor es la ecuación que con más frecuencia queda dentro del 10 % de lo medido, sin acertar siempre), así que es una señal para revisar, no una medición. Justifica el objetivo y programa una revisión.`,
        { kcal: Math.round(kcal), tmbEstimada: Math.round(plan.bmr), proporcion: Math.round(kcal / plan.bmr * 100) / 100 }))
    }
    if (kcal < th.minKcalReview) {
      out.push(signal('OBJETIVO_BAJO_UMBRAL', 'revision', 'decision_de_producto', `Por debajo del umbral de revisión (${fmtKcal(th.minKcalReview)} kcal)`,
        `El objetivo (${fmtKcal(kcal)} kcal) está por debajo del umbral de revisión interno de la app (${fmtKcal(th.minKcalReview)} kcal), que es provisional y configurable. NO es un mínimo de seguridad ni una garantía: por encima tampoco significa que el objetivo sea adecuado. Valora el caso, justifica la cifra y programa una revisión.`,
        { kcal: Math.round(kcal), umbral: th.minKcalReview }))
    }
  }

  // ── Macros ──
  // Dos tolerancias distintas, que no se mezclan:
  //  · REDONDEO (absoluta, `macroRoundingKcal`, 9 kcal): los gramos se enseñan enteros. Hasta esa cifra POR ENCIMA del objetivo es redondeo
  //    y se dice (nota informativa), no se calla.
  //  · INCOHERENCIA ENERGÉTICA: por encima del objetivo, lo que pase del redondeo; por debajo, lo que pase del máx(redondeo, `macroTolerancePct` %).
  // Con datos exactos (la calculadora pasa `remainingKcalForCarbs`) no hay tolerancia para «proteína + grasa superan el objetivo»; con gramos
  // escritos o mostrados (planes a mano) el margen es el del redondeo.
  const roundTol = th.macroRoundingKcal
  const pG = plan.proteinG, cG = plan.carbsG, fG = plan.fatG
  const havePF = isNum(pG) && isNum(fG) && isNum(kcal) && kcal > 0
  const exact = isNum(plan.remainingKcalForCarbs)
  const remaining = exact ? (plan.remainingKcalForCarbs as number) : havePF ? (kcal as number) - ((pG as number) * 4 + (fG as number) * 9) : null
  if (isNum(remaining) && remaining < (exact ? 0 : -roundTol)) {
    out.push(signal('MACROS_INCOMPATIBLES', 'bloqueo', 'aritmetica', 'Proteína y grasa superan el objetivo energético',
      `Entre proteína y grasa ya suman ${fmtKcal((isNum(kcal) ? kcal : 0) - remaining)} kcal y el objetivo es ${fmtKcal(kcal ?? 0)}: no quedan calorías para hidratos (faltarían ${fmtKcal(-remaining)} kcal). Baja los g/kg de proteína o de grasa, o sube el objetivo; no se presenta este reparto como válido.`,
      { kcal: isNum(kcal) ? Math.round(kcal) : null, kcalProteinaMasGrasa: isNum(kcal) ? Math.round(kcal - remaining) : null, exceso: Math.round(-remaining) }))
  } else {
    if (isNum(cG) && cG < th.minCarbsG) {
      out.push(signal('CARBOHIDRATOS_BAJOS', 'advertencia', 'decision_de_producto', `Hidratos por debajo de ${th.minCarbsG} g`,
        `Quedan ${Math.round(cG)} g de hidratos. ${th.minCarbsG} g es un umbral de aviso interno de la app, no un límite clínico ni un mínimo universal: revisa si el reparto es el que quieres.`,
        { carbohidratosG: Math.round(cG), umbral: th.minCarbsG }))
    }
    if ((options.checkMacroSum ?? true) && isNum(pG) && isNum(cG) && isNum(fG) && isNum(kcal) && kcal > 0) {
      const sum = pG * 4 + cG * 4 + fG * 9
      const diff = sum - kcal
      const incoherenceBelow = Math.max(roundTol, (kcal * th.macroTolerancePct) / 100)
      const evidence = { kcal: Math.round(kcal), kcalDeMacros: Math.round(sum), diferencia: Math.round(diff), toleranciaRedondeo: roundTol, toleranciaIncoherenciaPorDebajo: Math.round(incoherenceBelow) }
      if (diff > roundTol || diff < -incoherenceBelow) {
        out.push(signal('MACROS_NO_CUADRAN', 'advertencia', 'aritmetica', 'Las kcal no cuadran con los macros',
          `Los macros suman ${fmtKcal(sum)} kcal y el objetivo es ${fmtKcal(kcal)} (${diff > 0 ? '+' : '−'}${fmtKcal(Math.abs(diff))} kcal). ${diff > 0 ? `Por encima del objetivo, más de lo que explica el redondeo a gramos enteros (${roundTol} kcal)` : `Por debajo del objetivo, más del ${th.macroTolerancePct} % (y de ${roundTol} kcal)`}: revisa cuál de los dos es el correcto.`,
          evidence))
      } else if (diff > 0) {
        out.push(signal('MACROS_REDONDEO', 'info', 'aritmetica', 'Los gramos enteros suman un poco más que el objetivo',
          `Con los gramos enteros que ves, los macros suman ${fmtKcal(sum)} kcal: ${fmtKcal(diff)} más que el objetivo (${fmtKcal(kcal)}). Es redondeo (como mucho ${roundTol} kcal), no una incoherencia.`, evidence))
      }
    }
  }

  return finish(out)
}

function finish(signals: PlanSignal[]): PlanEvaluation {
  const sorted = [...signals].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
  const level = levelOf(sorted)
  return { level, signals: sorted, blocked: level === 'bloqueo', needsProfessionalReview: sorted.some(s => s.severity === 'revision'), needsSpecificProfessionalEvaluation: sorted.some(s => s.code === 'EMBARAZO_LACTANCIA_REVISION') }
}

/** Las señales que merece la pena enseñar (todas menos las meramente informativas, que van aparte). */
export const visibleSignals = (e: PlanEvaluation) => e.signals.filter(s => s.severity !== 'info')
