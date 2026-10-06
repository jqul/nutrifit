import { describe, it, expect } from 'vitest'
import { Food } from '../types'
import { EXCHANGE_GROUPS, MAX_SUBSTITUTE_GRAMS, groupOfFood, suggestSubstitutes } from './exchangeGroups'

let n = 0
const food = (name: string, category: string, kcal: number, proteinG: number, carbsG: number, fatG: number): Food =>
  ({ id: `f${++n}`, name, category, kcal, proteinG, carbsG, fatG })

// Valores por 100 g del catálogo real.
const pollo = food('Pechuga de pollo', 'Proteína', 165, 31, 0, 3.6)
const pavo = food('Pavo (pechuga)', 'Proteína', 135, 30, 0, 1.7)
const merluza = food('Merluza', 'Proteína', 86, 17, 0, 1.3)
const salmon = food('Salmón', 'Proteína', 208, 20, 0, 13)
const huevo = food('Huevo entero', 'Proteína', 155, 13, 1.1, 11)
const gambas = food('Gambas', 'Proteína', 99, 24, 0.2, 0.3)
const tofu = food('Tofu', 'Proteína', 76, 8, 1.9, 4.8)
const seitan = food('Seitán', 'Proteína', 370, 75, 14, 1.9)
const lentejas = food('Lentejas (cocidas)', 'Legumbre', 116, 9, 20, 0.4)
const garbanzos = food('Garbanzos (cocidos)', 'Legumbre', 164, 8.9, 27, 2.6)
const soja = food('Soja texturizada (seca)', 'Legumbre', 330, 50, 30, 1)
const arroz = food('Arroz blanco (cocido)', 'Carbohidrato', 130, 2.7, 28, 0.3)
const pasta = food('Pasta (cocida)', 'Carbohidrato', 158, 5.8, 31, 0.9)
const patata = food('Patata (cocida)', 'Carbohidrato', 87, 1.9, 20, 0.1)
const manzana = food('Manzana', 'Fruta', 52, 0.3, 14, 0.2)
const platano = food('Plátano', 'Fruta', 89, 1.1, 23, 0.3)
const brocoli = food('Brócoli', 'Verdura', 34, 2.8, 7, 0.4)
const calabacin = food('Calabacín', 'Verdura', 17, 1.2, 3.1, 0.3)
const leche = food('Leche entera', 'Lácteo', 64, 3.3, 4.8, 3.6)
const yogur = food('Yogur natural', 'Lácteo', 61, 3.5, 4.7, 3.3)
const queso = food('Queso fresco', 'Lácteo', 98, 11, 3.4, 4.3)
const avena = food('Leche de avena', 'Lácteo', 45, 1, 7, 1.5)
const almendraBeb = food('Leche de almendra', 'Lácteo', 24, 0.9, 0.5, 1.7)
const nata = food('Nata para cocinar', 'Lácteo', 195, 2.5, 3.6, 19)
const aceite = food('Aceite de oliva', 'Grasa', 884, 0, 0, 100)
const almendras = food('Almendras', 'Fruto seco', 579, 21, 22, 50)
const creatina = food('Creatina monohidrato', 'Suplemento', 0, 0, 0, 0)
const miel = food('Miel', 'Otros', 304, 0.3, 82, 0)

const catalog = [pollo, pavo, merluza, salmon, huevo, gambas, tofu, seitan, lentejas, garbanzos, soja, arroz, pasta, patata,
  manzana, platano, brocoli, calabacin, leche, yogur, queso, avena, almendraBeb, nata, aceite, almendras, creatina, miel]

describe('groupOfFood', () => {
  it('puts the catalog categories in their exchange group', () => {
    expect(groupOfFood(pollo)).toBe('proteina_animal')
    expect(groupOfFood(merluza)).toBe('proteina_animal')
    expect(groupOfFood(huevo)).toBe('proteina_animal')
    expect(groupOfFood(lentejas)).toBe('legumbres')
    expect(groupOfFood(arroz)).toBe('cereales')
    expect(groupOfFood(patata)).toBe('cereales')
    expect(groupOfFood(manzana)).toBe('fruta')
    expect(groupOfFood(brocoli)).toBe('verdura')
    expect(groupOfFood(yogur)).toBe('lacteos')
    expect(groupOfFood(aceite)).toBe('grasas')
    expect(groupOfFood(almendras)).toBe('grasas')
  })

  it('separates vegetable protein from animal protein, even across categories', () => {
    expect(groupOfFood(tofu)).toBe('proteina_vegetal')
    expect(groupOfFood(seitan)).toBe('proteina_vegetal')
    expect(groupOfFood(soja)).toBe('proteina_vegetal')   // está en "Legumbre" pero es proteína vegetal
    expect(groupOfFood(food('Tempeh', 'Proteína', 193, 19, 9, 11))).toBe('proteina_vegetal')
  })

  it('separates plant drinks from dairy, and cream from milk', () => {
    expect(groupOfFood(avena)).toBe('bebidas_vegetales')
    expect(groupOfFood(almendraBeb)).toBe('bebidas_vegetales')
    expect(groupOfFood(leche)).toBe('lacteos')
    expect(groupOfFood(nata)).toBe('grasas')
  })

  it('leaves supplements and sweets without a group', () => {
    expect(groupOfFood(creatina)).toBeNull()
    expect(groupOfFood(miel)).toBeNull()
  })

  it('places a custom food by its category, like any other', () => {
    expect(groupOfFood(food('Pollo asado de mi casa', 'Proteína', 190, 27, 0, 9))).toBe('proteina_animal')
    expect(groupOfFood(food('Bebida de avena sin azúcar', 'Lácteo', 40, 1, 6, 1))).toBe('bebidas_vegetales')
  })

  it('has a well-formed definition for every group', () => {
    for (const g of Object.values(EXCHANGE_GROUPS)) {
      expect(g.label).toBeTruthy()
      expect(g.rationText).toBeTruthy()
      if (g.ration.basis === 'macro') expect(g.ration.amount).toBeGreaterThan(0)
      else expect(g.ration.grams).toBeGreaterThan(0)
    }
  })
})

const item = (name: string, grams: number | null, f: Food) => {
  const k = (grams ?? 100) / 100
  return { foodName: name, grams, kcal: f.kcal * k, proteinG: f.proteinG * k, carbsG: f.carbsG * k, fatG: f.fatG * k }
}
const names = (r: { suggestions: { food: Food }[] }) => r.suggestions.map(s => s.food.name)

describe('suggestSubstitutes — mismo grupo', () => {
  it('offers only the same group, matched ration for ration', () => {
    // 150 g de pollo = 46,5 g de proteína
    const r = suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'group', matchBy: 'kcal', limit: 20 })
    expect(r.grouped).toBe(true)
    expect(r.group?.id).toBe('proteina_animal')
    expect(r.matchBy).toBe('proteinG')   // en modo grupo manda el nutriente clave del grupo, no el que estuviera elegido
    expect(r.rations).toBe(2.3)          // 46,5 / 20
    expect(names(r).sort()).toEqual(['Gambas', 'Huevo entero', 'Merluza', 'Pavo (pechuga)', 'Salmón'].sort())
    // los gramos igualan la proteína: 46,5 g / 0,30 = 155 g de pavo
    expect(r.suggestions.find(s => s.food.name === 'Pavo (pechuga)')!.grams).toBeCloseTo(155, 0)
  })

  it('never mixes in other groups (no yogurt or tofu for chicken)', () => {
    const r = suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'group', matchBy: 'proteinG', limit: 50 })
    expect(names(r)).not.toContain('Yogur natural')
    expect(names(r)).not.toContain('Tofu')
  })

  it('ranks the most similar food first (turkey before eggs for chicken)', () => {
    const r = suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'group', matchBy: 'proteinG' })
    expect(names(r)[0]).toBe('Pavo (pechuga)')
  })

  it('swaps carbs by carbs inside cereals', () => {
    const r = suggestSubstitutes({ item: item('Arroz blanco (cocido)', 200, arroz), foods: catalog, scope: 'group', matchBy: 'proteinG', limit: 20 })
    expect(r.matchBy).toBe('carbsG')
    expect(names(r).sort()).toEqual(['Pasta (cocida)', 'Patata (cocida)'])
    // 200 g de arroz = 56 g de carbos = 180 g de pasta
    expect(r.suggestions.find(s => s.food.name === 'Pasta (cocida)')!.grams).toBeCloseTo(180.6, 0)
  })

  it('swaps fruit for fruit', () => {
    const r = suggestSubstitutes({ item: item('Manzana', 150, manzana), foods: catalog, scope: 'group', matchBy: 'kcal' })
    expect(names(r)).toEqual(['Plátano'])
    expect(r.suggestions[0].grams).toBeCloseTo(91.3, 0)   // 21 g de carbos / 0,23
  })

  it('swaps weight-based groups gram for gram', () => {
    const r = suggestSubstitutes({ item: item('Brócoli', 200, brocoli), foods: catalog, scope: 'group', matchBy: 'kcal' })
    expect(names(r)).toEqual(['Calabacín'])
    expect(r.suggestions[0].grams).toBe(200)
    expect(r.rations).toBe(1.3)
  })

  it('assumes one serving when the unit is not convertible (e.g. "unidad")', () => {
    const r = suggestSubstitutes({ item: item('Brócoli', null, brocoli), foods: catalog, scope: 'group', matchBy: 'kcal' })
    expect(r.suggestions[0].grams).toBe(150)
    expect(r.rations).toBe(1)
  })

  it('lets plant drinks replace each other, but not stand in for milk', () => {
    const r = suggestSubstitutes({ item: item('Leche de avena', 200, avena), foods: catalog, scope: 'group', matchBy: 'kcal' })
    expect(names(r)).toEqual(['Leche de almendra'])
    const lactea = suggestSubstitutes({ item: item('Leche entera', 200, leche), foods: catalog, scope: 'group', matchBy: 'kcal', limit: 10 })
    expect(names(lactea).sort()).toEqual(['Queso fresco', 'Yogur natural'])
  })

  it('drops substitutes that would need an absurd amount', () => {
    // 20 g de aceite = 20 g de grasa; las almendras (50 g/100 g) dan 40 g: razonable.
    const ok = suggestSubstitutes({ item: item('Aceite de oliva', 20, aceite), foods: catalog, scope: 'group', matchBy: 'fatG', limit: 10 })
    expect(names(ok)).toContain('Almendras')
    // un alimento casi sin grasa necesitaría kilos: se descarta
    const casiNada = food('Grasa fantasma', 'Grasa', 10, 0, 0, 0.5)
    const r = suggestSubstitutes({ item: item('Aceite de oliva', 20, aceite), foods: [...catalog, casiNada], scope: 'group', matchBy: 'fatG', limit: 20 })
    expect(names(r)).not.toContain('Grasa fantasma')
    for (const s of r.suggestions) expect(s.grams).toBeLessThanOrEqual(MAX_SUBSTITUTE_GRAMS)
  })

  it('skips the original food, whatever its case or accents', () => {
    const r = suggestSubstitutes({ item: item('PECHUGA DE POLLO', 100, pollo), foods: catalog, scope: 'group', matchBy: 'proteinG', limit: 50 })
    expect(names(r)).not.toContain('Pechuga de pollo')
  })
})

describe('suggestSubstitutes — todos los alimentos', () => {
  it('goes back to matching the chosen macro across every group', () => {
    const r = suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'all', matchBy: 'proteinG', limit: 50 })
    expect(r.grouped).toBe(false)
    expect(r.matchBy).toBe('proteinG')
    expect(r.rations).toBeNull()
    expect(r.group?.id).toBe('proteina_animal')   // sigue indicando de qué grupo es, para poder volver
    expect(names(r)).toContain('Tofu')
  })

  it('falls back to "all" for a food with no group', () => {
    const r = suggestSubstitutes({ item: item('Miel', 20, miel), foods: catalog, scope: 'group', matchBy: 'carbsG' })
    expect(r.group).toBeNull()
    expect(r.grouped).toBe(false)
    expect(r.suggestions.length).toBeGreaterThan(0)
  })

  it('falls back to "all" for a free-text food that is not in the catalog', () => {
    const r = suggestSubstitutes({ item: item('Mi guiso de la abuela', 200, pollo), foods: catalog, scope: 'group', matchBy: 'proteinG' })
    expect(r.group).toBeNull()
    expect(r.grouped).toBe(false)
  })
})

describe('suggestSubstitutes — alergias', () => {
  it('never suggests a food the client is allergic to, and says how many it hid', () => {
    const r = suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'group', matchBy: 'proteinG', allergies: 'Alergia al huevo y al marisco', limit: 50 })
    expect(names(r)).not.toContain('Huevo entero')
    expect(names(r)).not.toContain('Gambas')
    expect(r.hiddenByAllergy).toBe(2)
  })

  it('filters lactose in dairy and nuts in fats', () => {
    const lacteos = suggestSubstitutes({ item: item('Leche entera', 200, leche), foods: catalog, scope: 'group', matchBy: 'proteinG', allergies: 'intolerancia a la lactosa', limit: 10 })
    expect(lacteos.suggestions).toEqual([])
    expect(lacteos.hiddenByAllergy).toBe(2)
    const grasas = suggestSubstitutes({ item: item('Aceite de oliva', 20, aceite), foods: catalog, scope: 'group', matchBy: 'fatG', allergies: 'frutos secos', limit: 10 })
    expect(names(grasas)).not.toContain('Almendras')
  })

  it('applies to "all" mode too', () => {
    const r = suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'all', matchBy: 'proteinG', allergies: 'soja', limit: 50 })
    expect(names(r)).not.toContain('Tofu')
  })

  it('hides nothing when there are no allergies', () => {
    expect(suggestSubstitutes({ item: item('Pechuga de pollo', 150, pollo), foods: catalog, scope: 'group', matchBy: 'proteinG' }).hiddenByAllergy).toBe(0)
  })
})
