// Qué comprueba y qué NO comprueba el detector de alérgenos para las alergias que ha escrito un cliente.
//
// El detector (allergens.ts) solo compara palabras del nombre de cada alimento con 7 categorías. Esto no cambia nada de él:
// solo lee el texto libre de alergias y dice, para cada alergia, si el detector tiene reglas para ella. Tres estados:
//  · reconocida: hay reglas para esa categoría, pero la comprobación es LIMITADA (palabras del nombre, no ingredientes).
//  · no_reconocida: la alergia indicada no tiene reglas de detección.
//  · ambigua: el texto no permite identificar con seguridad qué alergia es.
// «Reconocida» NO significa que los alimentos estén verificados ni que el sistema pueda garantizar su compatibilidad.
import { ALLERGEN_IDS, ALLERGEN_LABELS, allergenTagConflicts } from './allergens'

export type CoverageStatus = 'reconocida' | 'no_reconocida' | 'ambigua'

export interface CoverageItem {
  /** El trozo del texto del cliente al que se refiere (tal como lo escribió, recortado). */
  text: string
  status: CoverageStatus
  /** Cómo se escribe la alergia, sin «alergia a…» (para enseñarla). */
  label: string
  /** Solo en «reconocida»: las categorías del detector con las que se comprueba. */
  categories: string[]
  /**
   * ¿El detector se activa de verdad con este texto? Es `false` cuando la categoría se reconoce (p. ej. «celíaca» es gluten) pero
   * el texto no contiene las palabras con las que el detector busca (solo «celíaco», «gluten» o «trigo»): en ese caso no marca
   * ningún alimento y el aviso lo dice.
   */
  detectorActivo: boolean
  /** Una pista solo para el profesional (p. ej. cómo escribir la alergia para que el detector la reconozca). */
  hint?: string
}

export interface AllergyCoverage {
  items: CoverageItem[]
  hasRecognized: boolean
  hasUnrecognized: boolean
  hasAmbiguous: boolean
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** «Ninguna», «no tiene», «—»…: no es una alergia. */
const NO_ALLERGY = /^(no|ninguna?|nada|n\/a|na|-+|—+|sin alergias?|no tiene( alergias?)?|no refiere( alergias?)?|ninguna conocida|no conocidas?|no hay)$/

/** Alérgenos de la lista de la UE (y alguno más) que el detector NO tiene, o que escribe de una forma que no reconoce. */
const KNOWN_UNRECOGNIZED: { re: RegExp; label: string; hint?: string }[] = [
  { re: /sesamo/, label: 'Sésamo' },
  { re: /\bapio\b/, label: 'Apio' },
  { re: /mostaza/, label: 'Mostaza' },
  { re: /sulfito|azufre/, label: 'Sulfitos' },
  { re: /altramuz|lupino/, label: 'Altramuces' },
  { re: /molusco|mejillon|almeja|calamar|pulpo|sepia|ostra|berberecho|vieira/, label: 'Moluscos' },
]

/**
 * Formas de escribir la celiaquía que pertenecen a la categoría gluten pero que el detector NO activa (solo reconoce «celíaco»,
 * «celiaco», «gluten» y «trigo»): celiaquía, celíaca, enfermedad celíaca… Se miden sobre el texto sin tildes ni mayúsculas.
 */
const CELIAC_VARIANTS = /celiaqu|celiaca\b|enfermedad celiaca/
const CELIAC_HINT = 'Escríbelo como «celíaco» o «gluten» para que lo use.'

/** Palabras que indican un texto vago: no dice qué alimento o alérgeno es. */
const VAGUE = /\b(mal|sienta|molest|malestar|raro|reaccion|reacciona|varias|varios|algunas|algunos|cosas|no se|ni idea|comida|alimentos|general|todo|cualquier|digestion|digestiva|estomago|hinch)/

/** Quita el «alergia a…», «intolerancia a…», «no tolera…» del principio para quedarse con el alimento o alérgeno. */
function stripPrefix(segment: string): string {
  return segment
    .replace(/^\s*(tiene |tengo |soy |es )?(al[eé]rgic[oa]s?|alergias?|intolerante|intolerancias?|sensibilidad|no tolera|no tolero|evitar)\s*/i, '')
    // Las opciones largas primero: con «a» delante, «a la lactosa» dejaría «la lactosa».
    .replace(/^\s*(a las|a los|a la|de las|de los|de la|ante|del|al|de|a|las|los|la|el)\s+/i, '')
    .trim()
}

function split(text: string): string[] {
  return text
    // «pescado/marisco» son dos alergias, pero «celíaco/a» o «alérgico/a» no: la barra solo separa si hay dos letras a cada lado.
    .replace(/(\p{L}{2,})\/(\p{L}{2,})/gu, '$1,$2')
    .split(/[,;\n+()]|\s+\/\s+|\s+y\s+|\s+e\s+|\s+o\s+|\.\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export function allergyCoverage(text: string | null | undefined): AllergyCoverage {
  const items: CoverageItem[] = []
  // «n/a» o «ninguna conocida» enteros: se miran antes de partir el texto (la barra también separa alergias).
  if (NO_ALLERGY.test(fold(text ?? ''))) return { items, hasRecognized: false, hasUnrecognized: false, hasAmbiguous: false }
  for (const raw of split(text ?? '')) {
    const folded = fold(raw)
    if (!folded || NO_ALLERGY.test(folded)) continue
    const label = stripPrefix(raw)

    // 1. ¿Tiene reglas el detector? Se le pregunta con su propia API (las mismas palabras que usa para el texto del cliente).
    const categories = allergenTagConflicts(raw, ALLERGEN_IDS)
    if (categories.length > 0) {
      items.push({ text: raw, status: 'reconocida', label: capitalize(label || raw), categories, detectorActivo: true })
      continue
    }
    // 1b. Celiaquía y variantes: categoría gluten, pero el detector no se activa con esas palabras.
    if (CELIAC_VARIANTS.test(folded)) {
      items.push({ text: raw, status: 'reconocida', label: capitalize(label || raw), categories: ['gluten'], detectorActivo: false, hint: CELIAC_HINT })
      continue
    }
    // 2. Alérgenos conocidos que el detector no tiene.
    const known = KNOWN_UNRECOGNIZED.find(k => k.re.test(folded))
    if (known) {
      items.push({ text: raw, status: 'no_reconocida', label: known.label, categories: [], detectorActivo: false, hint: known.hint })
      continue
    }
    // 3. Sin objeto («alergia» a secas), vago o largo: no se sabe qué alergia es.
    const object = fold(label)
    const words = object.split(/\s+/).filter(Boolean)
    if (!object || VAGUE.test(folded) || words.length > 4) {
      items.push({ text: raw, status: 'ambigua', label: raw, categories: [], detectorActivo: false })
      continue
    }
    // 4. Un alimento o sustancia concreta que el detector no conoce.
    items.push({ text: raw, status: 'no_reconocida', label: capitalize(label), categories: [], detectorActivo: false })
  }
  return {
    items,
    hasRecognized: items.some(i => i.status === 'reconocida'),
    hasUnrecognized: items.some(i => i.status === 'no_reconocida'),
    hasAmbiguous: items.some(i => i.status === 'ambigua'),
  }
}

// ── Textos ───────────────────────────────────────────────────────────────────────────────────────

/** Lo que el detector hace y no hace. Se repite en cada categoría reconocida para que no se lea como una garantía. */
export const ALLERGY_LIMITATION =
  'Solo se comparan palabras del nombre de cada alimento: no se comprueban todos los ingredientes ni los alérgenos ocultos en productos compuestos.'

/** Aviso para el cliente (redacción aprobada). */
export const ALLERGY_NOTICE_CLIENT =
  'La información sobre alérgenos es orientativa y puede estar incompleta. Comprueba siempre la lista completa de ingredientes y las advertencias de la etiqueta del producto. Ante cualquier duda, no lo consideres apto hasta verificarlo.'

/** Aviso para el profesional. */
export const ALLERGY_NOTICE_PRO =
  'La comprobación de alérgenos es orientativa, limitada y puede estar incompleta. No sustituye la revisión completa de ingredientes y etiquetas ni tu criterio profesional. Que un alimento no tenga aviso no significa que sea seguro.'

/** Cuando el cliente ve que se han ocultado alimentos en las sustituciones: el filtrado no es una garantía (redacción aprobada). */
export const ALLERGY_HIDDEN_NOTICE =
  'Se han ocultado algunos alimentos que el sistema ha identificado como posibles conflictos con las alergias indicadas. La detección es limitada y puede no identificar todos los alérgenos. Los alimentos que siguen apareciendo no están verificados como seguros.'

export type CoverageAudience = 'pro' | 'client'

/** Una línea por alergia: qué se comprueba y qué no. Sin palabras de garantía. */
export function coverageLine(item: CoverageItem, audience: CoverageAudience): string {
  if (item.status === 'reconocida') {
    if (!item.detectorActivo) {
      // La categoría se reconoce, pero el detector no se activa con estas palabras: en vez del párrafo largo de las reconocidas
      // (que describiría una comprobación que aquí no ocurre), una frase corta con las dos advertencias que importan.
      const short = `${item.label}: categoría reconocida, detección limitada. El detector actual no identifica todos los alimentos con gluten y, con esta forma de escribirlo, no marca ninguno: revisa a mano todos los alimentos.`
      return audience === 'pro' && item.hint ? `${short} ${item.hint}` : short
    }
    const as = item.categories.map(c => (ALLERGEN_LABELS[c] ?? c).toLowerCase()).join(' y ')
    return `${item.label}: categoría reconocida, detección limitada (se comprueba como: ${as}). ${ALLERGY_LIMITATION} Que se reconozca no significa que los alimentos estén verificados.`
  }
  if (item.status === 'no_reconocida') {
    const base = `${item.label}: categoría no reconocida. El sistema no tiene reglas de detección para esta alergia: revisa a mano todos los alimentos.`
    return audience === 'pro' && item.hint ? `${base} ${item.hint}` : base
  }
  return `«${item.text}»: información ambigua. No permite identificar con seguridad qué alergia es; conviene concretarla (qué alimento o alérgeno).`
}
