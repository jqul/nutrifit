import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { RecipeRow } from '../../../lib/supabase-types'
import { Food } from '../../../types'
import { DEMO_RECIPES } from '../../../lib/demo-data'
import { toast } from '../../shared/Toast'
import { RecipeEditorPanel } from '../../shared/RecipeEditorPanel'
import { DIET_TYPES, MEAL_TYPES, MealType, allTags, filterRecipes, mealTypeLabel } from '../../../lib/recipeMeta'
import { ALLERGEN_LABELS } from '../../../lib/allergens'
import { Trash2, Plus, Copy, BookOpen, Search } from 'lucide-react'

/** Recetario: recetas propias (editables) y las del sistema (solo copiar). */
export function RecipesPanel({ nutricionistaId, demoMode, foods }: { nutricionistaId: string; demoMode?: boolean; foods: Food[] }) {
  const [recipes, setRecipes] = useState<RecipeRow[]>(demoMode ? DEMO_RECIPES : [])
  const [loading, setLoading] = useState(!demoMode)
  const [query, setQuery] = useState('')
  const [mealTypeFilter, setMealTypeFilter] = useState<MealType | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [dietFilter, setDietFilter] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (demoMode) { setRecipes(DEMO_RECIPES); return }
    setLoading(true)
    // Recetas propias + del sistema (nutricionista_id null) — antes esta
    // pantalla solo mostraba las propias, así que las del sistema no se
    // podían ni ver ni copiar desde aquí, solo dentro del plan de un cliente.
    const { data } = await supabase.from('recipes').select('*').or(`nutricionista_id.eq.${nutricionistaId},nutricionista_id.is.null`).order('name')
    setRecipes(data || [])
    setLoading(false)
  }, [nutricionistaId, demoMode])

  useEffect(() => { load() }, [load])

  const deleteRecipe = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setRecipes(prev => prev.filter(r => r.id !== id))
    await supabase.from('recipes').delete().eq('id', id)
    toast('Receta eliminada', 'ok')
  }

  const copySystemRecipe = async (r: RecipeRow) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    const { error } = await supabase.from('recipes').insert({
      nutricionista_id: nutricionistaId, name: `${r.name} (copia)`, items: r.items, steps: r.steps, photo_url: r.photo_url,
      meal_type: r.meal_type ?? null, tags: r.tags ?? [], diet_types: r.diet_types ?? [], prep_minutes: r.prep_minutes ?? null, video_url: r.video_url ?? null, allergens: r.allergens ?? [], servings: r.servings ?? null,
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`"${r.name}" copiada a tus recetas ✓`, 'ok')
    await load()
  }

  // ── Editor de recetas ────────────────────────────────────────
  // 'new' = receta nueva vacía; RecipeRow = editando una existente; null = cerrado.
  const [recipeEditor, setRecipeEditor] = useState<RecipeRow | 'new' | null>(null)
  const closeRecipeEditor = () => setRecipeEditor(null)
  const handleRecipeSaved = () => { closeRecipeEditor(); load() }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">Recetario ({recipes.length})</h2>
          {!recipeEditor && (
            <button onClick={() => setRecipeEditor('new')} className="flex items-center gap-1 text-xs font-bold text-accent">
              <Plus className="w-3.5 h-3.5" /> Nueva receta
            </button>
          )}
        </div>

        {recipeEditor && (
          <div className="mb-3">
            <RecipeEditorPanel nutricionistaId={nutricionistaId} demoMode={demoMode} foods={foods}
              initial={recipeEditor === 'new' ? null : recipeEditor} onClose={closeRecipeEditor} onSaved={handleRecipeSaved} />
          </div>
        )}

        {recipes.length > 1 && (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o etiqueta…" aria-label="Buscar recetas"
                className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar recetas">
              {MEAL_TYPES.map(m => (
                <button key={m.id} onClick={() => setMealTypeFilter(mealTypeFilter === m.id ? null : m.id)} aria-pressed={mealTypeFilter === m.id}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mealTypeFilter === m.id ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>{m.label}</button>
              ))}
              {DIET_TYPES.filter(d => recipes.some(r => (r.diet_types ?? []).includes(d))).map(d => (
                <button key={d} onClick={() => setDietFilter(dietFilter === d ? null : d)} aria-pressed={dietFilter === d}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${dietFilter === d ? 'bg-ok text-white' : 'bg-ok/10 text-ok hover:bg-ok/20'}`}>{d}</button>
              ))}
              {allTags(recipes).slice(0, 12).map(tag => (
                <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} aria-pressed={tagFilter === tag}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${tagFilter === tag ? 'bg-accent text-white' : 'bg-accent/10 text-accent hover:bg-accent/20'}`}>#{tag}</button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const shown = filterRecipes(recipes, { query, mealType: mealTypeFilter, tag: tagFilter, dietType: dietFilter })
          const systemRecipes = shown.filter(r => r.nutricionista_id === null)
          const ownRecipes = shown.filter(r => r.nutricionista_id !== null)
          if (shown.length === 0 && recipes.length > 0) {
            return <div className="card p-6 text-center"><p className="text-muted text-sm">Ninguna receta encaja con ese filtro.</p></div>
          }
          if (ownRecipes.length === 0 && systemRecipes.length === 0 && !recipeEditor) {
            return (
              <div className="card p-6 text-center">
                <p className="text-muted text-sm">Todavía no tienes ninguna. Pulsa "Nueva receta" para crear la primera.</p>
              </div>
            )
          }
          return (
            <div className="space-y-4">
              {ownRecipes.length > 0 && (
                <div className="space-y-2">
                  {ownRecipes.map(r => (
                    <RecipeListCard key={r.id} recipe={r} onClick={() => setRecipeEditor(r)} onDelete={() => deleteRecipe(r.id)} />
                  ))}
                </div>
              )}
              {systemRecipes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Recetas del sistema (compartidas, de solo lectura)</p>
                  <div className="space-y-2">
                    {systemRecipes.map(r => (
                      <RecipeListCard key={r.id} recipe={r} onCopy={() => copySystemRecipe(r)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
  )
}

function RecipeListCard({ recipe: r, onClick, onDelete, onCopy }: {
  recipe: RecipeRow; onClick?: () => void; onDelete?: () => void; onCopy?: () => void
}) {
  const items = (r.items as { foodName?: string }[] | null) || []
  return (
    <div onClick={onClick}
      className={`card p-4 flex items-center justify-between gap-3 transition-colors ${onClick ? 'cursor-pointer hover:border-accent/50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {r.photo_url ? (
          <img src={r.photo_url} alt={r.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-bg-alt flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{r.name}</p>
          <p className="text-xs text-muted mt-0.5 truncate">
            {items.length} alimento{items.length === 1 ? '' : 's'}
            {items.length > 0 && ` (${items.map(i => i.foodName).filter(Boolean).join(', ')})`}
          </p>
          {(r.meal_type || (r.tags && r.tags.length > 0) || (r.diet_types && r.diet_types.length > 0) || r.prep_minutes || (r.allergens && r.allergens.length > 0) || r.in_recipe_book) && (
            <p className="text-xs mt-1 flex flex-wrap items-center gap-1">
              {r.meal_type && <span className="px-1.5 py-0.5 rounded-full bg-bg-alt text-muted font-medium">{mealTypeLabel(r.meal_type)}</span>}
              {r.prep_minutes ? <span className="text-muted">{r.prep_minutes} min</span> : null}
              {r.servings ? <span className="text-muted">{r.servings} {r.servings === 1 ? 'ración' : 'raciones'}</span> : null}
              {(r.allergens ?? []).length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-warn/10 text-warn font-medium">Contiene: {(r.allergens ?? []).map(a => (ALLERGEN_LABELS[a] ?? a).toLowerCase()).join(', ')}</span>}
              {(r.diet_types ?? []).map(d => <span key={d} className="px-1.5 py-0.5 rounded-full bg-ok/10 text-ok">{d}</span>)}
              {(r.tags ?? []).map(tag => <span key={tag} className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">#{tag}</span>)}
              {r.in_recipe_book && <span className="inline-flex items-center gap-1 text-ok font-medium"><BookOpen className="w-3 h-3" /> {(r.book_tags ?? []).length > 0 ? `En el libro de: ${(r.book_tags ?? []).map(x => '#' + x).join(' ')}` : 'En el libro del cliente'}</span>}
            </p>
          )}
        </div>
      </div>
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar receta">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      {onCopy && (
        <button onClick={e => { e.stopPropagation(); onCopy() }} className="p-2 text-muted hover:text-accent flex-shrink-0" title="Copiar a tus recetas">
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
