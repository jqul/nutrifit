// Ajustar las comidas al objetivo: lleva lo que SUMA el plan (las cantidades de
// cada alimento) hasta sus kcal objetivo, cambiando lo menos posible.
//
// Reglas, pensadas para que el resultado se parezca a lo que haría un nutricionista:
//  · La diferencia de kcal se reparte entre proteína, carbohidratos y grasas según lo
//    lejos que esté cada uno de su objetivo: si faltan kcal, suben los que están por
//    debajo; si sobran, bajan los que están por encima. Así los tres se acercan a la vez
//    a lo que pide el plan, en vez de cargar todo en el mismo sitio.
//  · Si ya están todos en su objetivo (o el plan no los fija), la diferencia sale de
//    carbohidratos y grasas según el reparto que pide el plan, y la proteína solo se
//    toca si ya no queda otra cosa que mover.
//  · Cada alimento puede cambiar como mucho un 40 % hacia abajo o un 50 % hacia arriba.
//  · Lo que casi no aporta kcal (verdura, café, especias) y lo que no tiene una
//    cantidad numérica ("al gusto") no se toca.
//  · Las cantidades quedan redondeadas a algo que se pueda pesar (5 g, o 0,5 de una
//    unidad), y las kcal y macros se recalculan sobre la cantidad ya redondeada.
//  · Las opciones alternativas de una comida (Opción B de la cena…) se escalan con la
//    misma proporción que su comida, para que sigan siendo equivalentes.
//
// Es una propuesta: no guarda nada. Quien la usa decide si la aplica.

export interface FitItem {
  id: string; foodName: string; quantity: string; unit: string
  kcal: string; proteinG: string; carbsG: string; fatG: string; fiberG?: string
}

export interface FitMeal<I extends FitItem = FitItem> {
  id: string; name: string
  items: I[]
}

export interface FitTargets { kcal: number; proteinG: number; carbsG: number; fatG: number }

export interface FitTotals { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }

export interface FitChange {
  mealId: string; mealName: string; itemId: string; foodName: string
  from: number; to: number; unit: string
  /** 'slot' = comida del plan; 'option' = alternativa de una comida, escalada con ella. */
  kind: 'slot' | 'option'
}

export interface FitResult {
  /** ¿Queda dentro de la tolerancia (±2 % de kcal)? */
  reached: boolean
  before: FitTotals
  after: FitTotals
  changes: FitChange[]
  /** Cantidad nueva de cada alimento que cambia (id → cantidad). */
  quantities: Record<string, number>
  /** Cuánto cambian las kcal de cada comida que cambia (id → factor), para ajustar su objetivo propio. */
  mealFactors: Record<string, number>
  notes: string[]
}

export const FIT_MIN_SCALE = 0.6
export const FIT_MAX_SCALE = 1.5
export const FIT_TOLERANCE = 0.02
/** Un alimento casi sin kcal (un plato de verdura, un café) se considera "libre" y no se ajusta. */
export const FIT_MIN_ITEM_KCAL = 30
/** Lo mismo para lo poco denso por 100 g (verduras, fresas…): da igual que pese mucho, no es de donde salen las kcal. */
export const FIT_MIN_DENSITY_KCAL_PER_100G = 60

const num = (s: string | undefined) => { const n = parseFloat((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const MASS = new Set(['g', 'ml'])

/** Paso al que se redondea una cantidad: de 5 en 5 si pesa/mide, de 0,5 en 0,5 si son unidades. */
export function quantityStep(unit: string, quantity: number): number {
  if (MASS.has(unit.toLowerCase().trim())) return quantity >= 25 ? 5 : 1
  return 0.5
}
export function roundQuantity(unit: string, quantity: number): number {
  const step = quantityStep(unit, quantity)
  return Math.max(step, Math.round(quantity / step) * step)
}

type Role = 'protein' | 'carbs' | 'fat'

interface Flex {
  item: FitItem; mealId: string; mealName: string
  q0: number; kcal0: number; p0: number; c0: number; f0: number; fib0: number
  role: Role
  s: number
}

const zero = (): FitTotals => ({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
function addTotals(t: FitTotals, k: number, p: number, c: number, f: number, fib: number) {
  t.kcal += k; t.proteinG += p; t.carbsG += c; t.fatG += f; t.fiberG += fib
}
const round1 = (n: number) => Math.round(n * 10) / 10
const roundTotals = (t: FitTotals): FitTotals => ({ kcal: Math.round(t.kcal), proteinG: round1(t.proteinG), carbsG: round1(t.carbsG), fatG: round1(t.fatG), fiberG: round1(t.fiberG) })

function roleOf(p: number, c: number, f: number): Role {
  const kp = p * 4, kc = c * 4, kf = f * 9
  return kc >= kp && kc >= kf ? 'carbs' : kf >= kp && kf >= kc ? 'fat' : 'protein'
}

/**
 * `slots` son las comidas que de verdad se suman en el día (una por hueco);
 * `alternatives` las otras opciones de un hueco, con el `slotId` del que cuelgan.
 */
export function fitPlanToTargets(input: {
  slots: FitMeal[]
  alternatives?: { meal: FitMeal; slotId: string }[]
  targets: FitTargets
}): FitResult {
  const { slots, alternatives = [], targets } = input
  const notes: string[] = []

  const before = zero()
  const fixed = zero()
  const flex: Flex[] = []
  for (const meal of slots) {
    for (const item of meal.items) {
      const q0 = num(item.quantity)
      const k = num(item.kcal), p = num(item.proteinG), c = num(item.carbsG), f = num(item.fatG), fib = num(item.fiberG)
      addTotals(before, k, p, c, f, fib)
      const lowDensity = MASS.has(item.unit.toLowerCase().trim()) && q0 > 0 && (k / q0) * 100 < FIT_MIN_DENSITY_KCAL_PER_100G
      if (q0 > 0 && k >= FIT_MIN_ITEM_KCAL && !lowDensity) {
        flex.push({ item, mealId: meal.id, mealName: meal.name, q0, kcal0: k, p0: p, c0: c, f0: f, fib0: fib, role: roleOf(p, c, f), s: 1 })
      } else {
        addTotals(fixed, k, p, c, f, fib)
      }
    }
  }

  const empty = (extra: string[], reached = false): FitResult => ({
    reached, before: roundTotals(before), after: roundTotals(before), changes: [], quantities: {}, mealFactors: {}, notes: extra,
  })

  if (targets.kcal <= 0) return empty(['El plan no tiene un objetivo de kcal: fíjalo primero.'])
  if (before.kcal <= 0) return empty(['Las comidas no suman nada todavía.'])
  if (Math.abs(before.kcal - targets.kcal) / targets.kcal <= FIT_TOLERANCE) {
    return empty(['Las comidas ya están dentro del 2 % del objetivo: no hace falta ajustar.'], true)
  }
  if (flex.length === 0) return empty(['No hay alimentos que se puedan ajustar (solo verdura u otros sin una cantidad numérica).'])

  const totalKcal = () => fixed.kcal + flex.reduce((a, x) => a + x.kcal0 * x.s, 0)

  // ── Reparto iterativo de la diferencia de kcal ──
  const weightOf: Record<Role, number> = {
    carbs: targets.carbsG > 0 ? targets.carbsG * 4 : 0,
    fat: targets.fatG > 0 ? targets.fatG * 9 : 0,
    protein: 0,
  }
  for (let i = 0; i < 80; i++) {
    const delta = targets.kcal - totalKcal()
    if (Math.abs(delta) <= targets.kcal * 0.001) break
    const dir = delta > 0 ? 1 : -1
    const capacity = (role: Role) => flex.filter(x => x.role === role)
      .reduce((a, x) => a + x.kcal0 * (dir > 0 ? FIT_MAX_SCALE - x.s : x.s - FIT_MIN_SCALE), 0)
    const kcalOfRole = (role: Role) => flex.filter(x => x.role === role).reduce((a, x) => a + x.kcal0 * x.s, 0)

    // Lo lejos que está cada macro de su objetivo, en kcal, en el sentido que hay que mover.
    const macroNow: Record<Role, number> = {
      protein: fixed.proteinG + flex.reduce((a, x) => a + x.p0 * x.s, 0),
      carbs: fixed.carbsG + flex.reduce((a, x) => a + x.c0 * x.s, 0),
      fat: fixed.fatG + flex.reduce((a, x) => a + x.f0 * x.s, 0),
    }
    const macroTarget: Record<Role, number> = { protein: targets.proteinG, carbs: targets.carbsG, fat: targets.fatG }
    const kcalPerG: Record<Role, number> = { protein: 4, carbs: 4, fat: 9 }
    let weights: Record<Role, number> = { carbs: 0, fat: 0, protein: 0 }
    for (const role of ['protein', 'carbs', 'fat'] as Role[]) {
      if (macroTarget[role] <= 0 || capacity(role) <= 0.5) continue
      const gapKcal = (macroTarget[role] - macroNow[role]) * kcalPerG[role]
      weights[role] = Math.max(0, dir > 0 ? gapKcal : -gapKcal)
    }
    if (weights.protein + weights.carbs + weights.fat < 1) {
      // Ningún macro pide moverse en este sentido: se reparte entre carbohidratos y grasas como pide el plan.
      weights = { carbs: 0, fat: 0, protein: 0 }
      for (const role of ['carbs', 'fat'] as Role[]) {
        if (capacity(role) > 0.5) weights[role] = weightOf[role] > 0 ? weightOf[role] : kcalOfRole(role)
      }
      if (weights.carbs + weights.fat === 0 && capacity('protein') > 0.5) weights = { carbs: 0, fat: 0, protein: 1 }
    }
    const total = weights.carbs + weights.fat + weights.protein
    if (total === 0) break   // nada más que mover

    for (const role of ['carbs', 'fat', 'protein'] as Role[]) {
      if (weights[role] === 0) continue
      const roleKcal = kcalOfRole(role)
      if (roleKcal <= 0) continue
      const factor = 1 + (delta * weights[role] / total) / roleKcal
      for (const x of flex) if (x.role === role) x.s = clamp(x.s * factor, FIT_MIN_SCALE, FIT_MAX_SCALE)
    }
  }

  // ── Redondeo a cantidades que se puedan pesar y recálculo sobre ellas ──
  const quantityOf = new Map<Flex, number>()
  const roundAll = () => { for (const x of flex) quantityOf.set(x, roundQuantity(x.item.unit, x.q0 * x.s)) }
  const scaleOf = (x: Flex) => (quantityOf.get(x) ?? x.q0) / x.q0
  const kcalNow = () => fixed.kcal + flex.reduce((a, x) => a + x.kcal0 * scaleOf(x), 0)
  roundAll()

  // Pulido: si el redondeo se ha comido la precisión, un paso a la vez en el alimento que más acerca.
  for (let i = 0; i < 15; i++) {
    const gap = targets.kcal - kcalNow()
    if (Math.abs(gap) / targets.kcal <= FIT_TOLERANCE / 2) break
    const dir = gap > 0 ? 1 : -1
    let best: { x: Flex; q: number; err: number } | null = null
    for (const x of flex) {
      const cur = quantityOf.get(x) ?? x.q0
      const step = quantityStep(x.item.unit, cur)
      const q = cur + dir * step
      if (q / x.q0 > FIT_MAX_SCALE + 1e-9 || q / x.q0 < FIT_MIN_SCALE - 1e-9 || q <= 0) continue
      const err = Math.abs(gap - dir * x.kcal0 * (step / x.q0))
      if (best == null || err < best.err) best = { x, q, err }
    }
    if (!best || best.err >= Math.abs(gap)) break
    quantityOf.set(best.x, best.q)
  }

  // ── Resultado: lo que cambia y lo que suma ──
  const after = { ...fixed }
  const quantities: Record<string, number> = {}
  const changes: FitChange[] = []
  const mealKcal = new Map<string, { before: number; after: number }>()
  const bump = (mealId: string, b: number, a: number) => {
    const cur = mealKcal.get(mealId) ?? { before: 0, after: 0 }
    mealKcal.set(mealId, { before: cur.before + b, after: cur.after + a })
  }
  for (const meal of slots) for (const item of meal.items) {
    if (!flex.some(x => x.item === item)) bump(meal.id, num(item.kcal), num(item.kcal))
  }
  for (const x of flex) {
    const q = quantityOf.get(x) ?? x.q0
    const s = q / x.q0
    addTotals(after, x.kcal0 * s, x.p0 * s, x.c0 * s, x.f0 * s, x.fib0 * s)
    bump(x.mealId, x.kcal0, x.kcal0 * s)
    if (Math.abs(q - x.q0) > 1e-9) {
      quantities[x.item.id] = q
      changes.push({ mealId: x.mealId, mealName: x.mealName, itemId: x.item.id, foodName: x.item.foodName, from: x.q0, to: q, unit: x.item.unit, kind: 'slot' })
    }
  }
  const mealFactors: Record<string, number> = {}
  for (const [id, v] of mealKcal) if (v.before > 0 && Math.abs(v.after - v.before) > 1e-9) mealFactors[id] = v.after / v.before

  // ── Alternativas: la misma proporción que su comida ──
  for (const { meal, slotId } of alternatives) {
    const factor = mealFactors[slotId]
    if (factor == null) continue
    let altBefore = 0, altAfter = 0
    for (const item of meal.items) {
      const q0 = num(item.quantity)
      altBefore += num(item.kcal)
      if (q0 <= 0) { altAfter += num(item.kcal); continue }
      const q = roundQuantity(item.unit, q0 * factor)
      altAfter += num(item.kcal) * (q / q0)
      if (Math.abs(q - q0) > 1e-9) {
        quantities[item.id] = q
        changes.push({ mealId: meal.id, mealName: meal.name, itemId: item.id, foodName: item.foodName, from: q0, to: q, unit: item.unit, kind: 'option' })
      }
    }
    if (altBefore > 0) mealFactors[meal.id] = altAfter / altBefore
  }

  const result: FitResult = {
    reached: Math.abs(after.kcal - targets.kcal) / targets.kcal <= FIT_TOLERANCE,
    before: roundTotals(before), after: roundTotals(after), changes, quantities, mealFactors, notes,
  }

  if (!result.reached) {
    const gap = Math.round(targets.kcal - after.kcal)
    notes.push(`Con estos alimentos no se llega al objetivo sin pasarse de los límites (−40 % / +50 % por alimento): ${gap > 0 ? 'faltan' : 'sobran'} ${Math.abs(gap)} kcal. Añade o quita algún alimento a mano.`)
  }
  const off = (actual: number, target: number) => target > 0 ? Math.abs(actual - target) / target : 0
  const g = (n: number) => String(round1(n)).replace('.', ',')
  if (off(after.proteinG, targets.proteinG) > 0.1) notes.push(`La proteína queda en ${g(after.proteinG)} g (objetivo ${targets.proteinG} g).`)
  if (off(after.carbsG, targets.carbsG) > 0.15) notes.push(`Los carbohidratos quedan en ${g(after.carbsG)} g (objetivo ${targets.carbsG} g).`)
  if (off(after.fatG, targets.fatG) > 0.15) notes.push(`Las grasas quedan en ${g(after.fatG)} g (objetivo ${targets.fatG} g).`)
  if (changes.length === 0 && result.reached === false) notes.push('No se ha podido cambiar ninguna cantidad.')
  return result
}
