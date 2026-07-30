// Detección aproximada de alérgenos: cruza el texto libre de alergias del
// cliente con el nombre de un alimento por palabras clave. Es un aviso para
// que el nutricionista revise, no una verificación médica.

const ALLERGEN_KEYWORDS: Record<string, { clientHints: string[]; foodHints: string[] }> = {
  lactosa: {
    clientHints: ['lactosa', 'lácteo', 'lacteo', 'leche'],
    foodHints: ['leche', 'yogur', 'queso', 'nata', 'mantequilla', 'requesón', 'requeson', 'lácteo', 'lacteo'],
  },
  frutos_secos: {
    clientHints: ['frutos secos', 'fruto seco', 'nuez', 'nueces', 'almendra', 'cacahuete'],
    foodHints: ['almendra', 'nuez', 'nueces', 'avellana', 'cacahuete', 'pistacho', 'anacardo'],
  },
  gluten: {
    clientHints: ['gluten', 'celiaco', 'celíaco', 'trigo'],
    foodHints: ['trigo', 'pan', 'pasta', 'harina', 'cebada', 'centeno', 'cuscús', 'cuscus'],
  },
  huevo: {
    clientHints: ['huevo'],
    foodHints: ['huevo', 'clara de huevo'],
  },
  marisco: {
    clientHints: ['marisco', 'crustáceo', 'crustaceo'],
    foodHints: ['gamba', 'langostino', 'cigala', 'marisco', 'mejillón', 'mejillon'],
  },
  pescado: {
    clientHints: ['pescado'],
    foodHints: ['salmón', 'salmon', 'merluza', 'atún', 'atun', 'bacalao', 'pescado'],
  },
  soja: {
    clientHints: ['soja'],
    foodHints: ['soja', 'tofu', 'edamame'],
  },
}

export function detectAllergenConflict(clientAllergies: string, foodName: string): string | null {
  const allergyText = clientAllergies.toLowerCase()
  const nameText = foodName.toLowerCase()
  if (!allergyText.trim() || !nameText.trim()) return null
  for (const [category, { clientHints, foodHints }] of Object.entries(ALLERGEN_KEYWORDS)) {
    const clientMatches = clientHints.some(h => allergyText.includes(h))
    if (!clientMatches) continue
    // "sin lactosa", "sin gluten"... — el propio nombre ya indica que es seguro, no marcar.
    const explicitlyFree = clientHints.some(h => nameText.includes(`sin ${h}`))
    if (explicitlyFree) continue
    const foodMatches = foodHints.some(h => nameText.includes(h))
    if (foodMatches) return category
  }
  return null
}
