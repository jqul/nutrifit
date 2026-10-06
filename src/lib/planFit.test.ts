import { describe, it, expect } from 'vitest'
import { FitItem, FitMeal, FIT_MAX_SCALE, FIT_MIN_SCALE, fitPlanToTargets, roundQuantity } from './planFit'

let n = 0
/** Un plato a partir de los valores por 100 g y la cantidad en gramos (o unidades). */
const item = (foodName: string, grams: number, per100: { kcal: number; p: number; c: number; f: number; fib?: number }, unit = 'g'): FitItem => {
  const k = unit === 'g' || unit === 'ml' ? grams / 100 : grams   // para unidades, per100 = valores por unidad
  return {
    id: `i${++n}`, foodName, quantity: String(grams), unit,
    kcal: String(Math.round(per100.kcal * k * 10) / 10), proteinG: String(Math.round(per100.p * k * 10) / 10),
    carbsG: String(Math.round(per100.c * k * 10) / 10), fatG: String(Math.round(per100.f * k * 10) / 10),
    fiberG: String(Math.round((per100.fib ?? 0) * k * 10) / 10),
  }
}
const meal = (id: string, name: string, items: FitItem[]): FitMeal => ({ id, name, items })

const POLLO = { kcal: 165, p: 31, c: 0, f: 3.6 }
const ARROZ = { kcal: 130, p: 2.7, c: 28, f: 0.3 }
const AVENA = { kcal: 370, p: 13, c: 60, f: 7, fib: 10 }
const ACEITE = { kcal: 884, p: 0, c: 0, f: 100 }
const BROCOLI = { kcal: 34, p: 2.8, c: 7, f: 0.4, fib: 2.6 }
const YOGUR = { kcal: 61, p: 3.5, c: 4.7, f: 3.3 }
const PLATANO = { kcal: 89, p: 1.1, c: 23, f: 0.3, fib: 2.6 }
const ALMENDRAS = { kcal: 579, p: 21, c: 22, f: 50, fib: 12 }

// Un día de unas 2.340 kcal (el ejemplo de la revisión).
const day = (): FitMeal[] => [
  meal('m1', 'Desayuno', [item('Avena', 80, AVENA), item('Yogur natural', 200, YOGUR), item('Plátano', 120, PLATANO)]),
  meal('m2', 'Comida', [item('Pechuga de pollo', 220, POLLO), item('Arroz blanco (cocido)', 300, ARROZ), item('Brócoli', 150, BROCOLI), item('Aceite de oliva', 20, ACEITE)]),
  meal('m3', 'Cena', [item('Pechuga de pollo', 180, POLLO), item('Arroz blanco (cocido)', 220, ARROZ), item('Brócoli', 200, BROCOLI), item('Aceite de oliva', 15, ACEITE)]),
  meal('m4', 'Merienda', [item('Almendras', 30, ALMENDRAS), item('Plátano', 100, PLATANO)]),
]
const TARGET = { kcal: 2200, proteinG: 150, carbsG: 250, fatG: 70 }

describe('fitPlanToTargets — el caso de la revisión: 2.340 → 2.200 kcal', () => {
  const r = fitPlanToTargets({ slots: day(), targets: TARGET })

  it('starts above the target and ends within 2 %', () => {
    expect(r.before.kcal).toBeGreaterThan(2300)
    expect(r.reached).toBe(true)
    expect(Math.abs(r.after.kcal - TARGET.kcal) / TARGET.kcal).toBeLessThanOrEqual(0.02)
  })

  it('takes calories out of what is above its target', () => {
    expect(r.after.carbsG).toBeLessThan(r.before.carbsG)
    expect(r.after.fatG).toBeLessThan(r.before.fatG)
  })

  it('brings every macro closer to its target at the same time', () => {
    for (const k of ['proteinG', 'carbsG', 'fatG'] as const) {
      expect(Math.abs(r.after[k] - TARGET[k])).toBeLessThan(Math.abs(r.before[k] - TARGET[k]))
    }
  })

  it('changes quantities to weighable amounts', () => {
    expect(r.changes.length).toBeGreaterThan(0)
    for (const c of r.changes) {
      expect(c.unit).toBe('g')
      expect(c.to % 5 === 0 || c.to < 25).toBe(true)
    }
  })

  it('never moves a food beyond the limits', () => {
    for (const c of r.changes) {
      expect(c.to / c.from).toBeGreaterThanOrEqual(FIT_MIN_SCALE - 0.03)
      expect(c.to / c.from).toBeLessThanOrEqual(FIT_MAX_SCALE + 0.03)
    }
  })

  it('leaves vegetables alone (almost no calories)', () => {
    expect(r.changes.some(c => c.foodName === 'Brócoli')).toBe(false)
  })

  it('reports the change per meal so its own target can follow', () => {
    for (const id of ['m1', 'm2', 'm3', 'm4']) expect(r.mealFactors[id]).toBeLessThan(1)
  })

  it('does not mutate what it was given', () => {
    const meals = day()
    const snapshot = JSON.stringify(meals)
    fitPlanToTargets({ slots: meals, targets: TARGET })
    expect(JSON.stringify(meals)).toBe(snapshot)
  })

  it('gives the same answer every time', () => {
    const a = fitPlanToTargets({ slots: day(), targets: TARGET })
    const b = fitPlanToTargets({ slots: day(), targets: TARGET })
    expect(a.changes.map(c => [c.foodName, c.to])).toEqual(b.changes.map(c => [c.foodName, c.to]))
  })
})

describe('fitPlanToTargets — hacia arriba y casos límite', () => {
  it('adds calories when the plan is below the target', () => {
    const r = fitPlanToTargets({ slots: day(), targets: { kcal: 2900, proteinG: 150, carbsG: 350, fatG: 90 } })
    expect(r.reached).toBe(true)
    expect(r.after.kcal).toBeGreaterThan(r.before.kcal)
    expect(Math.abs(r.after.kcal - 2900) / 2900).toBeLessThanOrEqual(0.02)
  })

  it('does nothing when it is already within 2 %', () => {
    const r = fitPlanToTargets({ slots: day(), targets: { ...TARGET, kcal: Math.round(fitPlanToTargets({ slots: day(), targets: TARGET }).before.kcal) } })
    expect(r.changes).toEqual([])
    expect(r.reached).toBe(true)
    expect(r.notes.join(' ')).toContain('dentro del 2 %')
  })

  it('says so when there is no calorie target', () => {
    const r = fitPlanToTargets({ slots: day(), targets: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } })
    expect(r.changes).toEqual([])
    expect(r.reached).toBe(false)
    expect(r.notes[0]).toContain('objetivo de kcal')
  })

  it('says so when the meals are empty', () => {
    const r = fitPlanToTargets({ slots: [meal('m1', 'Desayuno', [])], targets: TARGET })
    expect(r.changes).toEqual([])
    expect(r.notes[0]).toContain('no suman nada')
  })

  it('does not pretend to reach an impossible target, and explains', () => {
    const r = fitPlanToTargets({ slots: day(), targets: { ...TARGET, kcal: 1000 } })
    expect(r.reached).toBe(false)
    expect(r.after.kcal).toBeGreaterThan(1000)
    expect(r.notes.join(' ')).toContain('sobran')
    for (const c of r.changes) expect(c.to / c.from).toBeGreaterThanOrEqual(FIT_MIN_SCALE - 0.03)
  })

  it('has nothing to adjust when everything is "free" or has no numeric quantity', () => {
    const meals = [meal('m1', 'Comida', [item('Brócoli', 200, BROCOLI), { ...item('Aceite al gusto', 10, ACEITE), quantity: 'al gusto' }])]
    const r = fitPlanToTargets({ slots: meals, targets: { kcal: 50, proteinG: 0, carbsG: 0, fatG: 0 } })
    expect(r.changes).toEqual([])
    expect(r.notes[0]).toContain('No hay alimentos que se puedan ajustar')
  })

  it('moves the protein when it is the only thing left to move', () => {
    // Solo hay pollo: es lo único que se puede mover
    const meals = [meal('m1', 'Comida', [item('Pechuga de pollo', 400, POLLO)])]
    const r = fitPlanToTargets({ slots: meals, targets: { kcal: 560, proteinG: 100, carbsG: 0, fatG: 0 } })
    expect(r.changes.length).toBe(1)
    expect(r.after.kcal).toBeLessThan(r.before.kcal)
  })

  it('adds protein, not only carbs, when the plan is short of both calories and protein', () => {
    const meals = [meal('m1', 'Comida', [item('Pechuga de pollo', 100, POLLO), item('Arroz blanco (cocido)', 100, ARROZ), item('Aceite de oliva', 5, ACEITE)])]
    const r = fitPlanToTargets({ slots: meals, targets: { kcal: 500, proteinG: 60, carbsG: 40, fatG: 15 } })
    expect(r.after.proteinG).toBeGreaterThan(r.before.proteinG * 1.2)
    const chicken = r.changes.find(c => c.foodName === 'Pechuga de pollo')
    expect(chicken && chicken.to > chicken.from).toBe(true)
  })

  it('leaves the protein alone when every macro is already on target and only the kcal are off', () => {
    const base = fitPlanToTargets({ slots: day(), targets: TARGET }).before
    const r = fitPlanToTargets({ slots: day(), targets: { kcal: Math.round(base.kcal * 0.9), proteinG: base.proteinG, carbsG: base.carbsG, fatG: base.fatG } })
    expect(r.reached).toBe(true)
    // las kcal bajan de carbohidratos y grasas: la proteína apenas se mueve
    expect(Math.abs(r.after.proteinG - base.proteinG) / base.proteinG).toBeLessThan(0.1)
    expect(r.after.carbsG).toBeLessThan(base.carbsG)
  })

  it('handles unit-based foods in half units', () => {
    const huevo = { kcal: 70, p: 6, c: 0.5, f: 5 }   // por unidad
    const meals = [meal('m1', 'Desayuno', [item('Huevo', 4, huevo, 'ud'), item('Avena', 100, AVENA)])]
    const r = fitPlanToTargets({ slots: meals, targets: { kcal: 560, proteinG: 0, carbsG: 0, fatG: 0 } })
    const egg = r.changes.find(c => c.foodName === 'Huevo')
    if (egg) expect((egg.to * 2) % 1).toBe(0)
  })

  it('spares the macro that is already below its target and cuts the one above it', () => {
    const fatHeavy = fitPlanToTargets({ slots: day(), targets: { kcal: 2200, proteinG: 150, carbsG: 100, fatG: 140 } })
    const carbHeavy = fitPlanToTargets({ slots: day(), targets: { kcal: 2200, proteinG: 150, carbsG: 400, fatG: 20 } })
    const fatCut = (r: typeof fatHeavy) => r.before.fatG - r.after.fatG
    expect(fatCut(carbHeavy)).toBeGreaterThan(fatCut(fatHeavy))
  })
})

describe('fitPlanToTargets — un plan muy lejos del objetivo', () => {
  // Como el plan de Laura de la demo: ~1.000 kcal con un objetivo de 1.900. Antes el ajuste inflaba la proteína
  // (120 g con un objetivo de 100) para intentar acercarse y aun así no llegaba.
  const PASTA = { kcal: 160, p: 5.8, c: 31, f: 0.9 }
  const ATUN = { kcal: 116, p: 26, c: 0, f: 1 }
  const PAVO = { kcal: 135, p: 30, c: 0, f: 1.7 }
  const TOMATE = { kcal: 80, p: 1.5, c: 9, f: 4 }
  const far = () => [
    meal('m1', 'Desayuno', [item('Tostadas integrales', 60, { kcal: 250, p: 9, c: 43, f: 4 }), item('Tomate frito', 40, TOMATE)]),
    meal('m2', 'Comida', [item('Pasta', 200, PASTA), item('Atún al natural', 60, ATUN), item('Tomate frito', 60, TOMATE)]),
    meal('m3', 'Cena', [item('Pavo', 150, PAVO), item('Brócoli', 150, BROCOLI)]),
  ]
  const T = { kcal: 1900, proteinG: 100, carbsG: 200, fatG: 60 }

  it('does not push any macro past its margin to chase calories it cannot reach', () => {
    const r = fitPlanToTargets({ slots: far(), targets: T })
    expect(r.before.kcal).toBeLessThan(1200)
    // 5 % de margen + lo que puede mover el redondeo a 5 g
    expect(r.after.proteinG).toBeLessThanOrEqual(T.proteinG * 1.08)
    expect(r.after.carbsG).toBeLessThanOrEqual(T.carbsG * 1.08)
    expect(r.after.fatG).toBeLessThanOrEqual(T.fatG * 1.08)
  })

  it('says the plan is far from the target and that quantities alone will not fix it', () => {
    const r = fitPlanToTargets({ slots: far(), targets: T })
    expect(r.reached).toBe(false)
    expect(r.notes[0]).toContain('muy lejos del objetivo')
    expect(r.notes[0]).toContain('faltan')
    expect(r.notes[0]).toContain('una comida o algún alimento')
  })

  it('never lets a macro fall far below its target when cutting', () => {
    const r = fitPlanToTargets({ slots: day(), targets: { kcal: 1500, proteinG: 150, carbsG: 150, fatG: 50 } })
    expect(r.after.proteinG).toBeGreaterThanOrEqual(150 * 0.88)
  })

  it('does not add the far-from-target note to a normal adjustment', () => {
    expect(fitPlanToTargets({ slots: day(), targets: TARGET }).notes.join(' ')).not.toContain('muy lejos')
  })
})

describe('fitPlanToTargets — opciones alternativas', () => {
  it('scales an alternative by the same proportion as its meal', () => {
    const slots = day()
    const alt = meal('m2b', 'Comida (opción B)', [item('Salmón', 180, { kcal: 208, p: 20, c: 0, f: 13 }), item('Patata', 300, { kcal: 87, p: 1.9, c: 20, f: 0.1 })])
    const r = fitPlanToTargets({ slots, alternatives: [{ meal: alt, slotId: 'm2' }], targets: TARGET })
    const factor = r.mealFactors['m2']
    expect(factor).toBeLessThan(1)
    expect(r.mealFactors['m2b']).toBeCloseTo(factor, 1)
    const optionChanges = r.changes.filter(c => c.kind === 'option')
    expect(optionChanges.length).toBeGreaterThan(0)
    for (const c of optionChanges) expect(c.mealId).toBe('m2b')
  })

  it('leaves an alternative alone when its meal did not change', () => {
    const slots = [meal('m1', 'Comida', [item('Pechuga de pollo', 200, POLLO), item('Arroz blanco (cocido)', 200, ARROZ)]), ...day().slice(1)]
    const alt = meal('m1b', 'Comida B', [item('Merluza', 200, { kcal: 86, p: 17, c: 0, f: 1.3 })])
    // desayuno intacto: el objetivo solo se logra tocando otras comidas si el desayuno ya no tiene margen; aquí basta con comprobar la coherencia
    const r = fitPlanToTargets({ slots, alternatives: [{ meal: alt, slotId: 'ninguna' }], targets: TARGET })
    expect(r.changes.some(c => c.mealId === 'm1b')).toBe(false)
  })
})

describe('roundQuantity', () => {
  it('rounds weights to 5 g (1 g for small amounts) and units to halves', () => {
    expect(roundQuantity('g', 123)).toBe(125)
    expect(roundQuantity('g', 12.4)).toBe(12)
    expect(roundQuantity('ml', 202)).toBe(200)
    expect(roundQuantity('ud', 2.3)).toBe(2.5)
    expect(roundQuantity('g', 0.2)).toBe(1)   // nunca 0
  })
})
