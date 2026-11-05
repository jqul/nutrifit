// Lo que a un cliente no le gusta comer, escrito a mano («pescado, coliflor; setas»). A diferencia de las alergias no es un
// riesgo, así que se trata como preferencia: «Proponer menú» y las sustituciones lo evitan, y el editor del plan avisa.

/** El mismo tope que la base de datos (columna food_dislikes). */
export const MAX_DISLIKES_LENGTH = 500

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** «Pescado, coliflor;  setas» → ['pescado', 'coliflor', 'setas'] (sin repetidos ni vacíos; sin acentos para comparar). */
export function parseDislikes(text: string | null | undefined): string[] {
  const out: string[] = []
  for (const raw of (text ?? '').split(/[,;\n]/)) {
    const term = fold(raw).trim().replace(/\s+/g, ' ')
    if (term.length >= 2 && !out.includes(term)) out.push(term)
  }
  return out
}

/** «setas» también casa con «seta» y «setas»; «huevos» con «huevo»: se prueba el término y su singular. */
function variants(term: string): string[] {
  const v = [term]
  if (term.endsWith('es') && term.length > 4) v.push(term.slice(0, -2))
  if (term.endsWith('s') && term.length > 3) v.push(term.slice(0, -1))
  return v
}

/**
 * ¿El nombre de un alimento (o receta) contiene algo que no le gusta? Devuelve el término que coincide, o null.
 * Compara por palabras que EMPIECEN así («pan» casa con «pan integral» pero no con «campana»), sin acentos ni mayúsculas.
 */
export function dislikeMatch(dislikes: string | string[] | null | undefined, foodName: string): string | null {
  const terms = Array.isArray(dislikes) ? dislikes : parseDislikes(dislikes)
  if (terms.length === 0) return null
  const name = fold(foodName)
  if (!name.trim()) return null
  for (const term of terms) {
    for (const v of variants(term)) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`(^|[^a-z0-9])${escaped}`).test(name)) return term
    }
  }
  return null
}
