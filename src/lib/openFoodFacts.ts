export interface ScannedFood {
  name: string; kcal: number; proteinG: number; carbsG: number; fatG: number
  fiberG: number | null; sugarG: number | null; sodiumMg: number | null; saturatedFatG: number | null
}

/** Busca un producto por código de barras (EAN/UPC) en la base de datos pública de OpenFoodFacts. */
export async function lookupBarcode(code: string): Promise<ScannedFood | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const n = p.nutriments || {}
  const name = p.product_name || p.generic_name || `Producto ${code}`
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? Math.round(n.energy_100g / 4.184) : null)
  if (kcal == null) return null
  return {
    name,
    kcal: Math.round(kcal),
    proteinG: Math.round((n.proteins_100g ?? 0) * 10) / 10,
    carbsG: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
    fatG: Math.round((n.fat_100g ?? 0) * 10) / 10,
    fiberG: n.fiber_100g != null ? Math.round(n.fiber_100g * 10) / 10 : null,
    sugarG: n.sugars_100g != null ? Math.round(n.sugars_100g * 10) / 10 : null,
    sodiumMg: n.sodium_100g != null ? Math.round(n.sodium_100g * 1000) : null,
    saturatedFatG: n['saturated-fat_100g'] != null ? Math.round(n['saturated-fat_100g'] * 10) / 10 : null,
  }
}
