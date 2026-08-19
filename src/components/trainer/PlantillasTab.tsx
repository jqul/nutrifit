import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { DietTemplateRow, RecipeRow } from '../../lib/supabase-types'
import { Food } from '../../types'
import { foodFromRow } from '../../lib/mappers'
import { DEMO_DIET_TEMPLATES, DEMO_RECIPES } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { Button } from '../shared/Button'
import { BookmarkPlus, ChefHat, Trash2, Plus, X } from 'lucide-react'

interface EditableItem {
  id: string; foodName: string; quantity: string; unit: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
  fiberG: string; sugarG: string; sodiumMg: string; saturatedFatG: string
  calciumMg: string; ironMg: string; zincMg: string
}
interface EditableMeal { id: string; name: string; time: string; kcalTarget: string; items: EditableItem[] }

function newId() { return crypto.randomUUID() }
function blankItem(): EditableItem {
  return { id: newId(), foodName: '', quantity: '', unit: '', kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '' }
}
function itemFromFood(food: Food): Partial<EditableItem> {
  return {
    foodName: food.name, quantity: '100', unit: 'g',
    kcal: String(food.kcal), proteinG: String(food.proteinG), carbsG: String(food.carbsG), fatG: String(food.fatG),
    fiberG: food.fiberG != null ? String(food.fiberG) : '', sugarG: food.sugarG != null ? String(food.sugarG) : '',
    sodiumMg: food.sodiumMg != null ? String(food.sodiumMg) : '', saturatedFatG: food.saturatedFatG != null ? String(food.saturatedFatG) : '',
    calciumMg: food.calciumMg != null ? String(food.calciumMg) : '', ironMg: food.ironMg != null ? String(food.ironMg) : '',
    zincMg: food.zincMg != null ? String(food.zincMg) : '',
  }
}

interface TemplatePlanShape {
  kcalTarget?: number; proteinG?: number; carbsG?: number; fatG?: number; fiberG?: number; advice?: string
  meals?: { name: string; time?: string; kcalTarget?: string | number; items?: EditableItem[] }[]
  supplements?: unknown[]
}

export function PlantillasTab({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const [templates, setTemplates] = useState<DietTemplateRow[]>(demoMode ? DEMO_DIET_TEMPLATES : [])
  const [recipes, setRecipes] = useState<RecipeRow[]>(demoMode ? DEMO_RECIPES.filter(r => r.nutricionista_id !== null) : [])
  const [loading, setLoading] = useState(!demoMode)
  const [foods, setFoods] = useState<Food[]>([])

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

  const load = useCallback(async () => {
    if (demoMode) { setTemplates(DEMO_DIET_TEMPLATES); setRecipes(DEMO_RECIPES.filter(r => r.nutricionista_id !== null)); return }
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

  // ── Editor de recetas ────────────────────────────────────────
  const [recipeEditor, setRecipeEditor] = useState<{ mode: 'new' | 'edit'; id?: string; name: string; steps: string; items: EditableItem[] } | null>(null)
  const [recipeSuggestFor, setRecipeSuggestFor] = useState<string | null>(null)

  const openNewRecipe = () => setRecipeEditor({ mode: 'new', name: '', steps: '', items: [blankItem()] })
  const openEditRecipe = (r: RecipeRow) => {
    const items = ((r.items as EditableItem[] | null) || []).map(i => ({ ...i, id: i.id || newId() }))
    setRecipeEditor({ mode: 'edit', id: r.id, name: r.name, steps: r.steps || '', items: items.length ? items : [blankItem()] })
  }
  const closeRecipeEditor = () => setRecipeEditor(null)

  const saveRecipeEditor = async () => {
    if (!recipeEditor) return
    if (!recipeEditor.name.trim()) { toast('Ponle un nombre a la receta', 'warn'); return }
    const items = recipeEditor.items.filter(i => i.foodName.trim())
    if (items.length === 0) { toast('Añade al menos un alimento', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); closeRecipeEditor(); return }
    const steps = recipeEditor.steps.trim() || null
    if (recipeEditor.mode === 'new') {
      const { error } = await supabase.from('recipes').insert({ nutricionista_id: nutricionistaId, name: recipeEditor.name.trim(), steps, items })
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast(`Receta "${recipeEditor.name.trim()}" creada ✓`, 'ok')
    } else {
      const { error } = await supabase.from('recipes').update({ name: recipeEditor.name.trim(), steps, items }).eq('id', recipeEditor.id)
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast('Receta actualizada ✓', 'ok')
    }
    closeRecipeEditor()
    await load()
  }

  // ── Editor de plantillas ─────────────────────────────────────
  const [templateEditor, setTemplateEditor] = useState<{
    mode: 'new' | 'edit'; id?: string; name: string
    kcalTarget: string; proteinG: string; carbsG: string; fatG: string; fiberG: string; advice: string
    meals: EditableMeal[]; supplements: unknown[]
  } | null>(null)
  const [tplSuggestFor, setTplSuggestFor] = useState<string | null>(null)

  const openNewTemplate = () => setTemplateEditor({
    mode: 'new', name: '', kcalTarget: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', advice: '',
    meals: [{ id: newId(), name: 'Desayuno', time: '', kcalTarget: '', items: [] }], supplements: [],
  })
  const openEditTemplate = (t: DietTemplateRow) => {
    const p = (t.plan || {}) as TemplatePlanShape
    setTemplateEditor({
      mode: 'edit', id: t.id, name: t.name,
      kcalTarget: p.kcalTarget != null ? String(p.kcalTarget) : '', proteinG: p.proteinG != null ? String(p.proteinG) : '',
      carbsG: p.carbsG != null ? String(p.carbsG) : '', fatG: p.fatG != null ? String(p.fatG) : '',
      fiberG: p.fiberG != null ? String(p.fiberG) : '', advice: p.advice || '',
      meals: (p.meals || []).map(m => ({
        id: newId(), name: m.name || '', time: m.time || '', kcalTarget: m.kcalTarget != null ? String(m.kcalTarget) : '',
        items: (m.items || []).map(i => ({ ...i, id: i.id || newId() })),
      })),
      supplements: p.supplements || [],
    })
  }
  const closeTemplateEditor = () => setTemplateEditor(null)

  const updateTplMeal = (id: string, updates: Partial<EditableMeal>) => {
    if (!templateEditor) return
    setTemplateEditor({ ...templateEditor, meals: templateEditor.meals.map(m => m.id === id ? { ...m, ...updates } : m) })
  }
  const addTplMeal = () => {
    if (!templateEditor) return
    setTemplateEditor({ ...templateEditor, meals: [...templateEditor.meals, { id: newId(), name: 'Comida', time: '', kcalTarget: '', items: [] }] })
  }
  const removeTplMeal = (id: string) => {
    if (!templateEditor) return
    setTemplateEditor({ ...templateEditor, meals: templateEditor.meals.filter(m => m.id !== id) })
  }
  const addTplItem = (mealId: string) => {
    const meal = templateEditor?.meals.find(m => m.id === mealId)
    if (!meal) return
    updateTplMeal(mealId, { items: [...meal.items, blankItem()] })
  }
  const removeTplItem = (mealId: string, itemId: string) => {
    const meal = templateEditor?.meals.find(m => m.id === mealId)
    if (!meal) return
    updateTplMeal(mealId, { items: meal.items.filter(i => i.id !== itemId) })
  }
  const updateTplItem = (mealId: string, itemId: string, updates: Partial<EditableItem>) => {
    const meal = templateEditor?.meals.find(m => m.id === mealId)
    if (!meal) return
    updateTplMeal(mealId, { items: meal.items.map(i => i.id === itemId ? { ...i, ...updates } : i) })
  }
  const selectTplFood = (mealId: string, itemId: string, food: Food) => {
    updateTplItem(mealId, itemId, itemFromFood(food))
    setTplSuggestFor(null)
  }

  const saveTemplateEditor = async () => {
    if (!templateEditor) return
    if (!templateEditor.name.trim()) { toast('Ponle un nombre a la plantilla', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); closeTemplateEditor(); return }
    const plan = {
      kcalTarget: parseFloat(templateEditor.kcalTarget) || 0, proteinG: parseFloat(templateEditor.proteinG) || 0,
      carbsG: parseFloat(templateEditor.carbsG) || 0, fatG: parseFloat(templateEditor.fatG) || 0,
      fiberG: parseFloat(templateEditor.fiberG) || 0, advice: templateEditor.advice,
      meals: templateEditor.meals.map(m => ({ name: m.name, time: m.time, kcalTarget: m.kcalTarget, items: m.items })),
      supplements: templateEditor.supplements,
    }
    if (templateEditor.mode === 'new') {
      const { error } = await supabase.from('diet_templates').insert({ nutricionista_id: nutricionistaId, name: templateEditor.name.trim(), plan })
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast(`Plantilla "${templateEditor.name.trim()}" creada ✓`, 'ok')
    } else {
      const { error } = await supabase.from('diet_templates').update({ name: templateEditor.name.trim(), plan }).eq('id', templateEditor.id)
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast('Plantilla actualizada ✓', 'ok')
    }
    closeTemplateEditor()
    await load()
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
          Créalas aquí directamente, o desde el plan de dieta de cualquier cliente con "Guardar como plantilla" /
          "Guardar esta comida como receta". Una vez guardadas, puedes aplicarlas o insertarlas en el plan de{' '}
          <strong>cualquier</strong> cliente, no solo el que las creó.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Plantillas de plan ({templates.length})</h2>
          {!templateEditor && (
            <button onClick={openNewTemplate} className="flex items-center gap-1 text-xs font-bold text-accent">
              <Plus className="w-3.5 h-3.5" /> Nueva plantilla
            </button>
          )}
        </div>

        {templateEditor && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3 mb-3">
            <div className="flex items-center gap-2">
              <input value={templateEditor.name} onChange={e => setTemplateEditor({ ...templateEditor, name: e.target.value })}
                placeholder="Nombre de la plantilla" autoFocus
                className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
              <button onClick={closeTemplateEditor} className="p-2 text-muted hover:text-warn"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <TplNumInput label="Kcal" value={templateEditor.kcalTarget} onChange={v => setTemplateEditor({ ...templateEditor, kcalTarget: v })} />
              <TplNumInput label="Prot. (g)" value={templateEditor.proteinG} onChange={v => setTemplateEditor({ ...templateEditor, proteinG: v })} />
              <TplNumInput label="Carbos (g)" value={templateEditor.carbsG} onChange={v => setTemplateEditor({ ...templateEditor, carbsG: v })} />
              <TplNumInput label="Grasas (g)" value={templateEditor.fatG} onChange={v => setTemplateEditor({ ...templateEditor, fatG: v })} />
              <TplNumInput label="Fibra (g)" value={templateEditor.fiberG} onChange={v => setTemplateEditor({ ...templateEditor, fiberG: v })} />
            </div>
            <textarea value={templateEditor.advice} onChange={e => setTemplateEditor({ ...templateEditor, advice: e.target.value })}
              placeholder="Consejo del nutricionista" rows={2}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs outline-none resize-none focus:ring-2 focus:ring-accent/20" />

            <div className="space-y-2">
              {templateEditor.meals.map(meal => (
                <div key={meal.id} className="bg-bg-alt rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={meal.name} onChange={e => updateTplMeal(meal.id, { name: e.target.value })} placeholder="Nombre (ej. Desayuno)"
                      className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <input type="time" value={meal.time} onChange={e => updateTplMeal(meal.id, { time: e.target.value })}
                      className="w-24 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <input type="number" value={meal.kcalTarget} onChange={e => updateTplMeal(meal.id, { kcalTarget: e.target.value })} placeholder="Kcal"
                      className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <button onClick={() => removeTplMeal(meal.id)} className="p-1.5 text-muted hover:text-warn flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {meal.items.map(item => {
                    const suggestions = tplSuggestFor === item.id && item.foodName.trim().length > 0
                      ? foods.filter(f => f.name.toLowerCase().includes(item.foodName.toLowerCase())).slice(0, 6)
                      : []
                    return (
                      <div key={item.id} className="relative flex items-center gap-1.5 pl-3">
                        <input value={item.foodName} onChange={e => updateTplItem(meal.id, item.id, { foodName: e.target.value })}
                          onFocus={() => setTplSuggestFor(item.id)} onBlur={() => setTimeout(() => setTplSuggestFor(null), 150)}
                          placeholder="Alimento"
                          className="flex-1 px-2 py-1 bg-bg border border-border rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-accent/20" />
                        <input value={item.quantity} onChange={e => updateTplItem(meal.id, item.id, { quantity: e.target.value })} placeholder="Cant."
                          className="w-12 px-2 py-1 bg-bg border border-border rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-accent/20" />
                        <input value={item.unit} onChange={e => updateTplItem(meal.id, item.id, { unit: e.target.value })} placeholder="Unidad"
                          className="w-14 px-2 py-1 bg-bg border border-border rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-accent/20" />
                        <button onClick={() => removeTplItem(meal.id, item.id)} className="p-1 text-muted hover:text-warn flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                        {suggestions.length > 0 && (
                          <div className="absolute z-10 top-full left-3 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {suggestions.map(f => (
                              <button key={f.id} type="button" onMouseDown={() => selectTplFood(meal.id, item.id, f)}
                                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                                <span>{f.name}</span>
                                <span className="text-muted flex-shrink-0">{f.kcal} kcal/100g</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <button onClick={() => addTplItem(meal.id)} className="flex items-center gap-1 text-[11px] text-muted hover:text-accent pl-3">
                    <Plus className="w-3 h-3" /> Añadir alimento
                  </button>
                </div>
              ))}
              <button onClick={addTplMeal} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir comida</button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={saveTemplateEditor}>Guardar plantilla</Button>
              <Button size="sm" variant="ghost" onClick={closeTemplateEditor}>Cancelar</Button>
            </div>
          </div>
        )}

        {templates.length === 0 && !templateEditor ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-muted text-sm">Todavía no tienes ninguna. Pulsa "Nueva plantilla" para crear la primera.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => {
              const plan = (t.plan || {}) as TemplatePlanShape
              const meals = plan.meals || []
              return (
                <div key={t.id} onClick={() => openEditTemplate(t)}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-accent/50 transition-colors">
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {plan.kcalTarget ? `${plan.kcalTarget} kcal · ` : ''}
                      {meals.length} comida{meals.length === 1 ? '' : 's'}
                      {meals.length > 0 && ` (${meals.map(m => m.name).filter(Boolean).join(', ')})`}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteTemplate(t.id) }} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar plantilla">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-1.5"><ChefHat className="w-4 h-4" /> Recetario ({recipes.length})</h2>
          {!recipeEditor && (
            <button onClick={openNewRecipe} className="flex items-center gap-1 text-xs font-bold text-accent">
              <Plus className="w-3.5 h-3.5" /> Nueva receta
            </button>
          )}
        </div>

        {recipeEditor && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3 mb-3">
            <div className="flex items-center gap-2">
              <input value={recipeEditor.name} onChange={e => setRecipeEditor({ ...recipeEditor, name: e.target.value })}
                placeholder="Nombre de la receta" autoFocus
                className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
              <button onClick={closeRecipeEditor} className="p-2 text-muted hover:text-warn"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              {recipeEditor.items.map(item => {
                const suggestions = recipeSuggestFor === item.id && item.foodName.trim().length > 0
                  ? foods.filter(f => f.name.toLowerCase().includes(item.foodName.toLowerCase())).slice(0, 6)
                  : []
                return (
                  <div key={item.id} className="relative flex items-center gap-1.5">
                    <input value={item.foodName}
                      onChange={e => setRecipeEditor({ ...recipeEditor, items: recipeEditor.items.map(i => i.id === item.id ? { ...i, foodName: e.target.value } : i) })}
                      onFocus={() => setRecipeSuggestFor(item.id)} onBlur={() => setTimeout(() => setRecipeSuggestFor(null), 150)}
                      placeholder="Alimento"
                      className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <input value={item.quantity}
                      onChange={e => setRecipeEditor({ ...recipeEditor, items: recipeEditor.items.map(i => i.id === item.id ? { ...i, quantity: e.target.value } : i) })}
                      placeholder="Cant." className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <input value={item.unit}
                      onChange={e => setRecipeEditor({ ...recipeEditor, items: recipeEditor.items.map(i => i.id === item.id ? { ...i, unit: e.target.value } : i) })}
                      placeholder="Unidad" className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <button onClick={() => setRecipeEditor({ ...recipeEditor, items: recipeEditor.items.filter(i => i.id !== item.id) })}
                      className="p-1.5 text-muted hover:text-warn flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {suggestions.map(f => (
                          <button key={f.id} type="button"
                            onMouseDown={() => { setRecipeEditor({ ...recipeEditor, items: recipeEditor.items.map(i => i.id === item.id ? { ...i, ...itemFromFood(f) } : i) }); setRecipeSuggestFor(null) }}
                            className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                            <span>{f.name}</span>
                            <span className="text-muted flex-shrink-0">{f.kcal} kcal/100g</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={() => setRecipeEditor({ ...recipeEditor, items: [...recipeEditor.items, blankItem()] })}
                className="flex items-center gap-1 text-xs text-muted hover:text-accent"><Plus className="w-3 h-3" /> Añadir alimento</button>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Pasos de preparación (opcional, un paso por línea)</label>
              <textarea value={recipeEditor.steps} onChange={e => setRecipeEditor({ ...recipeEditor, steps: e.target.value })} rows={4}
                placeholder={'1. Cuece la pasta...\n2. Dora la carne...'}
                className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-xs outline-none resize-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={saveRecipeEditor}>Guardar receta</Button>
              <Button size="sm" variant="ghost" onClick={closeRecipeEditor}>Cancelar</Button>
            </div>
          </div>
        )}

        {recipes.length === 0 && !recipeEditor ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-muted text-sm">Todavía no tienes ninguna. Pulsa "Nueva receta" para crear la primera.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recipes.map(r => {
              const items = (r.items as { foodName?: string }[] | null) || []
              return (
                <div key={r.id} onClick={() => openEditRecipe(r)}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-accent/50 transition-colors">
                  <div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {items.length} alimento{items.length === 1 ? '' : 's'}
                      {items.length > 0 && ` (${items.map(i => i.foodName).filter(Boolean).join(', ')})`}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteRecipe(r.id) }} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar receta">
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

function TplNumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}
