import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { RecipeRow } from '../../../lib/supabase-types'
import { Food } from '../../../types'
import { DEMO_RECIPES } from '../../../lib/demo-data'
import { toast } from '../../shared/Toast'
import { RecipeEditorPanel } from '../../shared/RecipeEditorPanel'
import { Trash2, Plus, Copy } from 'lucide-react'

/** Recetario: recetas propias (editables) y las del sistema (solo copiar). */
export function RecipesPanel({ nutricionistaId, demoMode, foods }: { nutricionistaId: string; demoMode?: boolean; foods: Food[] }) {
  const [recipes, setRecipes] = useState<RecipeRow[]>(demoMode ? DEMO_RECIPES : [])
  const [loading, setLoading] = useState(!demoMode)

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

        {(() => {
          const systemRecipes = recipes.filter(r => r.nutricionista_id === null)
          const ownRecipes = recipes.filter(r => r.nutricionista_id !== null)
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
