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
