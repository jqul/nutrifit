import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { DietTemplateRow, RecipeRow } from '../../lib/supabase-types'
import { DEMO_DIET_TEMPLATES, DEMO_RECIPES } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { BookmarkPlus, ChefHat, Trash2 } from 'lucide-react'

interface TemplatePlanShape {
  kcalTarget?: number
  meals?: { name: string; items?: unknown[] }[]
}
interface RecipeItemShape { foodName?: string }

export function PlantillasTab({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const [templates, setTemplates] = useState<DietTemplateRow[]>(demoMode ? DEMO_DIET_TEMPLATES : [])
  const [recipes, setRecipes] = useState<RecipeRow[]>(demoMode ? DEMO_RECIPES : [])
  const [loading, setLoading] = useState(!demoMode)

  const load = useCallback(async () => {
    if (demoMode) { setTemplates(DEMO_DIET_TEMPLATES); setRecipes(DEMO_RECIPES); return }
    setLoading(true)
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('diet_templates').select('*').eq('nutricionista_id', nutricionistaId).order('name'),
      supabase.from('recipes').select('*').eq('nutricionista_id', nutricionistaId).order('name'),
    ])
    setTemplates(t || [])
    setRecipes(r || [])
    setLoading(false)
  }, [nutricionistaId])

  useEffect(() => { load() }, [load])

  const deleteTemplate = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
    await supabase.from('diet_templates').delete().eq('id', id)
    toast('Plantilla eliminada', 'ok')
  }

  const deleteRecipe = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setRecipes(prev => prev.filter(r => r.id !== id))
    await supabase.from('recipes').delete().eq('id', id)
    toast('Receta eliminada', 'ok')
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BookmarkPlus className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-serif font-bold">Plantillas y recetario</h1>
        </div>
        <p className="text-sm text-muted">
          Se crean desde el plan de dieta de cualquier cliente — botón "Guardar como plantilla" (plan del día completo)
          o "Guardar esta comida como receta" (una sola comida). Una vez guardadas aquí, puedes aplicarlas o insertarlas
          en el plan de <strong>cualquier</strong> cliente, no solo el que las creó.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-3">Plantillas de plan ({templates.length})</h2>
        {templates.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-muted text-sm">
              Todavía no tienes ninguna. Entra en el plan de dieta de un cliente, móntalo y pulsa "Guardar como plantilla".
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => {
              const plan = (t.plan || {}) as TemplatePlanShape
              const meals = plan.meals || []
              return (
                <div key={t.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {plan.kcalTarget ? `${plan.kcalTarget} kcal · ` : ''}
                      {meals.length} comida{meals.length === 1 ? '' : 's'}
                      {meals.length > 0 && ` (${meals.map(m => m.name).filter(Boolean).join(', ')})`}
                    </p>
                  </div>
                  <button onClick={() => deleteTemplate(t.id)} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar plantilla">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><ChefHat className="w-4 h-4" /> Recetario ({recipes.length})</h2>
        {recipes.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-muted text-sm">
              Todavía no tienes ninguna. Dentro de una comida del plan de un cliente, pulsa "Guardar esta comida como receta".
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recipes.map(r => {
              const items = (r.items as RecipeItemShape[] | null) || []
              return (
                <div key={r.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {items.length} alimento{items.length === 1 ? '' : 's'}
                      {items.length > 0 && ` (${items.map(i => i.foodName).filter(Boolean).join(', ')})`}
                    </p>
                  </div>
                  <button onClick={() => deleteRecipe(r.id)} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar receta">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
