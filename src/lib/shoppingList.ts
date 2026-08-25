// Lista de la compra: agrega los ingredientes de todas las comidas de un
// plan por nombre+unidad, sumando cantidades cuando se puede. Compartida
// entre la vista del cliente (DietaClienteTab) y la del propio
// nutricionista dentro del editor de plan (PlanDietaTab), que trabajan con
// formas de datos ligeramente distintas (fiberG numérico en un caso, string
// en el otro mientras se edita) — de ahí el tipo de entrada laxo.

export interface ShoppingItem {
  key: string; foodName: string; unit: string
  totalQty: number | null; parts: string[]; fiberG: number
}

interface ShoppingListSourceItem {
  foodName: string; quantity: string; unit: string
  fiberG?: string | number | null
}
interface ShoppingListSourceMeal { items: ShoppingListSourceItem[] }

export function buildShoppingList(meals: ShoppingListSourceMeal[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>()
  for (const meal of meals) {
    for (const item of meal.items) {
      if (!item.foodName.trim()) continue
      const key = `${item.foodName.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`
      const qtyNum = parseFloat(item.quantity.replace(',', '.'))
      const fiber = typeof item.fiberG === 'string' ? parseFloat(item.fiberG) || 0 : item.fiberG || 0
      const existing = map.get(key)
      if (existing) {
        existing.totalQty = existing.totalQty !== null && !isNaN(qtyNum) ? existing.totalQty + qtyNum : null
        if (item.quantity) existing.parts.push(item.quantity)
        existing.fiberG += fiber
      } else {
        map.set(key, {
          key, foodName: item.foodName.trim(), unit: item.unit.trim(),
          totalQty: isNaN(qtyNum) ? null : qtyNum, parts: item.quantity ? [item.quantity] : [], fiberG: fiber,
        })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.foodName.localeCompare(b.foodName))
}

// ── Agrupación por pasillo del supermercado ──────────────────────────────
// Deriva el pasillo de la categoría del catálogo de alimentos (foods.category)
// buscando cada ingrediente de la lista por nombre — no hay categoría en el
// propio ítem de la comida, solo en el catálogo. Los ingredientes que no
// coinciden con ningún alimento del catálogo (comida escrita a mano, con
// erratas...) caen en "Otros", al final.
export interface ShoppingAisle { label: string; icon: string; items: ShoppingItem[] }

const AISLE_BY_CATEGORY: Record<string, { label: string; icon: string; order: number }> = {
  'Fruta': { label: 'Frutas y verduras', icon: '🥬', order: 0 },
  'Verdura': { label: 'Frutas y verduras', icon: '🥬', order: 0 },
  'Proteína': { label: 'Carnes y pescados', icon: '🥩', order: 1 },
  'Lácteo': { label: 'Lácteos', icon: '🥛', order: 2 },
  'Carbohidrato': { label: 'Despensa y cereales', icon: '🌾', order: 3 },
  'Legumbre': { label: 'Despensa y cereales', icon: '🌾', order: 3 },
  'Fruto seco': { label: 'Despensa y cereales', icon: '🌾', order: 3 },
  'Grasa': { label: 'Despensa y cereales', icon: '🌾', order: 3 },
  'Suplemento': { label: 'Suplementos', icon: '💊', order: 4 },
}
const OTHER_AISLE = { label: 'Otros', icon: '🛒', order: 5 }

/** Quita paréntesis y puntuación para poder comparar "Boniato asado" con
 * "Boniato (asado)" del catálogo — los ítems del plan los escribe el
 * nutricionista a mano y rara vez coinciden carácter a carácter. */
function normalizeFoodName(s: string): string {
  return s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

const MIN_FUZZY_MATCH_LENGTH = 4

function findCategory(itemName: string, foodsByNormalizedName: Map<string, string>): string | undefined {
  const normalizedItem = normalizeFoodName(itemName)
  const exact = foodsByNormalizedName.get(normalizedItem)
  if (exact) return exact
  // Sin coincidencia exacta: el ingrediente que contenga (o esté contenido
  // en) el nombre del alimento más largo que encaje — así "boniato asado"
  // encuentra "boniato" y "yogur natural sin lactosa" encuentra "yogur natural".
  let best: { name: string; category: string } | null = null
  for (const [name, category] of foodsByNormalizedName) {
    if (name.length < MIN_FUZZY_MATCH_LENGTH) continue
    if (normalizedItem.includes(name) || name.includes(normalizedItem)) {
      if (!best || name.length > best.name.length) best = { name, category }
    }
  }
  return best?.category
}

export function groupShoppingItemsByAisle(items: ShoppingItem[], foods: { name: string; category: string }[]): ShoppingAisle[] {
  const foodsByNormalizedName = new Map(foods.map(f => [normalizeFoodName(f.name), f.category]))
  const byLabel = new Map<string, ShoppingAisle & { order: number }>()
  for (const item of items) {
    const category = findCategory(item.foodName, foodsByNormalizedName)
    const aisle = (category && AISLE_BY_CATEGORY[category]) || OTHER_AISLE
    let group = byLabel.get(aisle.label)
    if (!group) { group = { label: aisle.label, icon: aisle.icon, order: aisle.order, items: [] }; byLabel.set(aisle.label, group) }
    group.items.push(item)
  }
  return Array.from(byLabel.values())
    .sort((a, b) => a.order - b.order)
    .map(({ label, icon, items }) => ({ label, icon, items }))
}
