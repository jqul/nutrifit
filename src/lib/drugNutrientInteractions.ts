// Detección aproximada de interacciones fármaco-nutriente: cruza el texto
// libre de medicación de la anamnesis con el nombre de un alimento del plan,
// por palabras clave — mismo patrón que allergens.ts (detectAllergenConflict).
// Es un aviso para que el nutricionista revise, NO una verificación médica ni
// sustituye al médico/farmacéutico del paciente — algunas de estas
// interacciones (ej. vitamina K con anticoagulantes) no significan "prohibido
// comerlo", sino "mantenlo constante", así que el aviso lleva el matiz en el
// propio texto en vez de sonar a alarma.

export interface DrugInteractionHit {
  category: string
  warning: string
  matchedFood: string
}

const DRUG_INTERACTIONS: Record<string, { drugHints: string[]; foodHints: string[]; warning: string }> = {
  anticoagulantes: {
    drugHints: ['sintrom', 'warfarina', 'acenocumarol', 'anticoagulante'],
    foodHints: [
      'espinaca', 'acelga', 'col rizada', 'kale', 'brócoli', 'brocoli',
      'espárrago', 'esparrago', 'coles de bruselas', 'perejil', 'lechuga',
    ],
    warning: 'Anticoagulante (Sintrom/warfarina) — la vitamina K de las verduras de hoja verde puede alterar el INR. No hace falta eliminarlas: lo importante es que la cantidad sea CONSTANTE día a día, no que varíe mucho de una semana a otra.',
  },
  tiroides: {
    drugHints: ['eutirox', 'levotiroxina', 'tirodril', 'hipotiroidismo'],
    foodHints: [
      'café', 'cafe', 'soja', 'leche', 'lácteo', 'lacteo', 'yogur', 'queso',
      'calcio', 'hierro', 'multivitamínico', 'multivitaminico',
    ],
    warning: 'Levotiroxina (Eutirox) — se absorbe peor si se toma junto a café, soja, lácteos o suplementos de calcio/hierro. Pauta el desayuno (o cualquier suplemento) separado al menos 30-60 min de la toma.',
  },
  estatinas: {
    drugHints: ['estatina', 'atorvastatina', 'simvastatina', 'rosuvastatina', 'pravastatina'],
    foodHints: ['pomelo', 'toronja'],
    warning: 'Estatinas — el pomelo (fruta o zumo) puede elevar sus niveles en sangre y el riesgo de efectos secundarios (dolor muscular, entre otros). Mejor evitarlo mientras dure el tratamiento.',
  },
  imao: {
    drugHints: ['imao', 'inhibidor de la monoaminooxidasa', 'fenelzina', 'tranilcipromina'],
    foodHints: ['queso curado', 'embutido curado', 'vino tinto', 'salsa de soja', 'encurtido'],
    warning: 'IMAO — los alimentos fermentados/curados con alto contenido en tiramina (quesos curados, embutidos curados, vino tinto, salsa de soja) pueden provocar una subida brusca de tensión arterial.',
  },
}

/**
 * ¿El texto de medicación del cliente y este alimento concreto encajan en
 * alguna interacción conocida? Devuelve la primera categoría que matchea
 * (un cliente rara vez está en más de una a la vez para el mismo alimento).
 */
export function detectDrugInteraction(medication: string, foodName: string): DrugInteractionHit | null {
  const medText = (medication || '').toLowerCase()
  const nameText = (foodName || '').toLowerCase()
  if (!medText.trim() || !nameText.trim()) return null
  for (const [category, { drugHints, foodHints, warning }] of Object.entries(DRUG_INTERACTIONS)) {
    if (!drugHints.some(h => medText.includes(h))) continue
    const matchedFood = foodHints.find(h => nameText.includes(h))
    if (matchedFood) return { category, warning, matchedFood }
  }
  return null
}
