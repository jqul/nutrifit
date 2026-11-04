import { useState } from 'react'
import { RecipeRow } from '../../lib/supabase-types'
import { MEAL_TYPES, MealType, filterRecipes, mealTypeLabel } from '../../lib/recipeMeta'
import { sumItemMacros, EditableItem } from '../trainer/client-panel/plan-dieta/planModel'
import { BottomSheet } from '../shared/BottomSheet'
import { ChefHat, Search } from 'lucide-react'

/**
 * El libro de recetas del cliente: las que su nutricionista ha marcado como visibles (aunque no estén en su plan), con
 * buscador y filtro por tipo de comida. Las cifras (kcal) solo salen si el nutricionista no se las oculta.
 */
export function RecipeBookSheet({ open, onClose, recipes, hideNumbers }: {
  open: boolean; onClose: () => void; recipes: RecipeRow[]; hideNumbers?: boolean
}) {
  const [query, setQuery] = useState('')
  const [mealType, setMealType] = useState<MealType | null>(null)
  const [viewing, setViewing] = useState<RecipeRow | null>(null)

  const shown = filterRecipes(recipes, { query, mealType })
  const typesPresent = MEAL_TYPES.filter(m => recipes.some(r => r.meal_type === m.id))
  const close = () => { setViewing(null); onClose() }

  if (viewing) {
    const items = ((viewing.items as EditableItem[] | null) || []).filter(i => i.foodName)
    const kcal = Math.round(sumItemMacros((viewing.items as EditableItem[] | null) || []).kcal)
    return (
      <BottomSheet open={open} onClose={close} title={viewing.name}>
        <div className="space-y-3">
          <button onClick={() => setViewing(null)} className="text-xs font-bold text-accent">← Todas las recetas</button>
          {viewing.photo_url && <img src={viewing.photo_url} alt={viewing.name} className="w-full aspect-video object-cover rounded-xl" />}
          {!hideNumbers && kcal > 0 && <p className="text-xs text-muted">Aprox. {kcal} kcal la receta entera</p>}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Ingredientes</p>
              <ul className="space-y-1">
                {items.map(i => (
                  <li key={i.id} className="text-sm flex justify-between gap-2">
                    <span>{i.foodName}</span><span className="text-muted">{i.quantity} {i.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {viewing.steps ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5"><ChefHat className="w-3.5 h-3.5" /> Preparación</p>
              <p className="text-sm whitespace-pre-line leading-relaxed">{viewing.steps}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Esta receta todavía no tiene pasos de preparación.</p>
          )}
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet open={open} onClose={close} title="Libro de recetas">
      <div className="space-y-3">
        {recipes.length > 4 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar una receta…" aria-label="Buscar recetas"
              className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
        )}
        {typesPresent.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de comida">
            {typesPresent.map(m => (
              <button key={m.id} onClick={() => setMealType(mealType === m.id ? null : m.id)} aria-pressed={mealType === m.id}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mealType === m.id ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>{m.label}</button>
            ))}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Ninguna receta encaja con eso.</p>
        ) : (
          <div className="space-y-2">
            {shown.map(r => (
              <button key={r.id} onClick={() => setViewing(r)} className="w-full flex items-center gap-3 bg-bg-alt hover:bg-accent/5 rounded-xl p-2.5 text-left transition-colors">
                {r.photo_url ? <img src={r.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-bg flex-shrink-0 flex items-center justify-center"><ChefHat className="w-5 h-5 text-muted" /></div>}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{r.name}</span>
                  <span className="block text-xs text-muted truncate">
                    {[mealTypeLabel(r.meal_type), ...(r.tags ?? []).map(t => `#${t}`)].filter(Boolean).join(' · ') || 'Receta'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
