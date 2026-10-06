export interface ScannedFood {
  name: string; kcal: number; proteinG: number; carbsG: number; fatG: number
  fiberG: number | null; sugarG: number | null; sodiumMg: number | null; saturatedFatG: number | null
  calciumMg: number | null; ironMg: number | null; zincMg: number | null
}

export type BarcodeLookup =
  | { ok: true; food: ScannedFood }
  | { ok: false; reason: 'not_found' | 'no_nutrition' | 'network' }

/**
 * Busca un producto por código de barras (EAN/UPC) en la base de datos pública de OpenFoodFacts.
 * Distingue "no existe" de "existe pero sin datos nutricionales" y de "no se pudo consultar" (sin red): antes
 * un corte de conexión dejaba el escáner en "Buscando producto…" para siempre.
 */
export async function lookupBarcodeDetailed(code: string): Promise<BarcodeLookup> {
  let data: any
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`)
    // 404 = ese código no está en la base de datos; cualquier otro fallo del servidor no dice nada del producto.
    if (res.status === 404) return { ok: false, reason: 'not_found' }
    if (!res.ok) return { ok: false, reason: 'network' }
    data = await res.json()
  } catch {
    return { ok: false, reason: 'network' }
  }
  if (data.status !== 1 || !data.product) return { ok: false, reason: 'not_found' }
  const p = data.product
  const n = p.nutriments || {}
  const name = p.product_name || p.generic_name || `Producto ${code}`
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? Math.round(n.energy_100g / 4.184) : null)
  if (kcal == null) return { ok: false, reason: 'no_nutrition' }
  return { ok: true, food: {
    name,
    kcal: Math.round(kcal),
    proteinG: Math.round((n.proteins_100g ?? 0) * 10) / 10,
    carbsG: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
    fatG: Math.round((n.fat_100g ?? 0) * 10) / 10,
    fiberG: n.fiber_100g != null ? Math.round(n.fiber_100g * 10) / 10 : null,
    sugarG: n.sugars_100g != null ? Math.round(n.sugars_100g * 10) / 10 : null,
    sodiumMg: n.sodium_100g != null ? Math.round(n.sodium_100g * 1000) : null,
    saturatedFatG: n['saturated-fat_100g'] != null ? Math.round(n['saturated-fat_100g'] * 10) / 10 : null,
    calciumMg: n.calcium_100g != null ? Math.round(n.calcium_100g * 1000) : null,
    ironMg: n.iron_100g != null ? Math.round(n.iron_100g * 1000 * 10) / 10 : null,
    zincMg: n.zinc_100g != null ? Math.round(n.zinc_100g * 1000 * 10) / 10 : null,
  } }
}

/** Compatibilidad: el producto o null si no se pudo obtener por la razón que sea. */
export async function lookupBarcode(code: string): Promise<ScannedFood | null> {
  const r = await lookupBarcodeDetailed(code)
  return r.ok ? r.food : null
}

const r1 = (n: number) => Math.round(n * 10) / 10
const comma = (n: number) => String(r1(n)).replace('.', ',')

/** Kcal y macros de `grams` gramos de un producto (los valores del producto son por 100 g). */
export function scannedMacros(food: Pick<ScannedFood, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>, grams: number) {
  const k = grams / 100
  return { kcal: Math.round(food.kcal * k), proteinG: r1(food.proteinG * k), carbsG: r1(food.carbsG * k), fatG: r1(food.fatG * k) }
}

/** La nota del diario para un producto escaneado: cantidad y macros de esa cantidad. */
export function scannedFoodNote(food: ScannedFood, grams: number): string {
  const m = scannedMacros(food, grams)
  return `${comma(grams)} g · ${m.kcal} kcal · P ${comma(m.proteinG)} g · C ${comma(m.carbsG)} g · G ${comma(m.fatG)} g (producto escaneado, Open Food Facts)`
}
