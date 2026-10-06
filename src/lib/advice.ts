/** Un consejo más largo que esto (o con varios párrafos) ocupa demasiado en el móvil: se muestra plegado. */
export const ADVICE_COLLAPSE_CHARS = 90

export function adviceNeedsCollapse(advice: string): boolean {
  const text = advice.trim()
  return text.length > ADVICE_COLLAPSE_CHARS || /\n/.test(text)
}
