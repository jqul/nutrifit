import { Food } from '../../../../types'
import { DietaryTag, DIETARY_TAG_LABELS, classifyFoodTags } from '../../../../lib/dietaryTags'

const FOOD_TAG_ORDER: DietaryTag[] = ['sin_gluten', 'sin_lactosa', 'bajo_fodmap', 'vegano', 'alto_proteina', 'bajo_sodio', 'alto_omega3']
const FOOD_TAG_SHORT: Record<DietaryTag, string> = {
  sin_gluten: 'SG', sin_lactosa: 'SL', bajo_fodmap: 'FODMAP-', vegano: 'V', alto_proteina: 'P+',
  bajo_sodio: 'Na-', alto_omega3: 'Ω3',
}

/** Pills de filtro rápido dietoterapéutico sobre el buscador de alimentos —
 * en modo AND: activar varias exige que el alimento cumpla todas a la vez. */

export function FoodTagFilterPills({ active, onToggle }: { active: DietaryTag[]; onToggle: (tag: DietaryTag) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 border-b border-border sticky top-0 bg-card">
      {FOOD_TAG_ORDER.map(tag => (
        <button key={tag} type="button" onMouseDown={e => e.preventDefault()} onClick={() => onToggle(tag)}
          className={`px-1.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
            active.includes(tag) ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
          }`}>
          {DIETARY_TAG_LABELS[tag]}
        </button>
      ))}
    </div>
  )
}

/** Etiquetas cortas junto al nombre del alimento en los resultados, para ver
 * de un vistazo si encaja sin tener que activar el filtro. */
export function FoodTagBadges({ food }: { food: Food }) {
  const tags = classifyFoodTags(food)
  const relevant = FOOD_TAG_ORDER.filter(t => tags.includes(t))
  if (relevant.length === 0) return null
  return (
    <span className="flex items-center gap-0.5 flex-shrink-0">
      {relevant.map(t => (
        <span key={t} title={DIETARY_TAG_LABELS[t]} className="px-1 py-0.5 bg-ok/10 text-ok rounded text-xs font-bold">
          {FOOD_TAG_SHORT[t]}
        </span>
      ))}
    </span>
  )
}
