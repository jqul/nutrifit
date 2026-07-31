import { useState, useEffect, useCallback } from 'react'
import { ClientData, DietPlan, Food } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { DietMealRow, DietMealItemRow, DietSupplementRow, DietTemplateRow, RecipeRow } from '../../../lib/supabase-types'
import { foodFromRow } from '../../../lib/mappers'
import { detectAllergenConflict } from '../../../lib/allergens'
import { sendPush } from '../../../lib/usePushNotifications'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'
import { Plus, Trash2, Eye, EyeOff, BookmarkPlus, AlertTriangle, ChefHat } from 'lucide-react'

interface EditableItem { id: string; foodName: string; quantity: string; unit: string; kcal: string; proteinG: string; carbsG: string; fatG: string }
interface EditableMeal { id: string; name: string; time: string; kcalTarget: string; items: EditableItem[] }
interface EditableSupplement { id: string; name: string; dose: string; timing: string; visibleToClient: boolean }

function newId() { return crypto.randomUUID() }

function demoPlanToEditable(plan: DietPlan) {
  return {
    kcalTarget: String(plan.kcalTarget), proteinG: String(plan.proteinG),
    carbsG: String(plan.carbsG), fatG: String(plan.fatG), advice: plan.advice,
    meals: plan.meals.map(m => ({
      id: m.id, name: m.name, time: m.time, kcalTarget: m.kcalTarget != null ? String(m.kcalTarget) : '',
      items: m.items.map(i => ({
        id: i.id, foodName: i.foodName, quantity: i.quantity, unit: i.unit,
        kcal: i.kcal != null ? String(i.kcal) : '', proteinG: i.proteinG != null ? String(i.proteinG) : '',
        carbsG: i.carbsG != null ? String(i.carbsG) : '', fatG: i.fatG != null ? String(i.fatG) : '',
      })),
    })),
    supplements: plan.supplements.map(s => ({ id: s.id, name: s.name, dose: s.dose, timing: s.timing, visibleToClient: s.visibleToClient })),
  }
}

export function PlanDietaTab({ client, nutricionistaId, demoPlan }: { client: ClientData; nutricionistaId: string; demoPlan?: DietPlan }) {
  const demoEditable = demoPlan ? demoPlanToEditable(demoPlan) : null
  const [loading, setLoading] = useState(!demoPlan)
  const [saving, setSaving] = useState(false)
  const [planId, setPlanId] = useState<string | null>(demoPlan ? demoPlan.id : null)
  const [kcalTarget, setKcalTarget] = useState(demoEditable?.kcalTarget ?? '')
  const [proteinG, setProteinG] = useState(demoEditable?.proteinG ?? '')
  const [carbsG, setCarbsG] = useState(demoEditable?.carbsG ?? '')
  const [fatG, setFatG] = useState(demoEditable?.fatG ?? '')
  const [advice, setAdvice] = useState(demoEditable?.advice ?? '')
  const [meals, setMeals] = useState<EditableMeal[]>(demoEditable?.meals ?? [])
  const [supplements, setSupplements] = useState<EditableSupplement[]>(demoEditable?.supplements ?? [])
  const [templates, setTemplates] = useState<DietTemplateRow[]>([])
  const [templateName, setTemplateName] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [openSuggestFor, setOpenSuggestFor] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [savingRecipeFor, setSavingRecipeFor] = useState<string | null>(null)
  const [recipeNameDraft, setRecipeNameDraft] = useState('')

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

  const loadRecipes = useCallback(async () => {
    if (demoPlan) return
    const { data } = await supabase.from('recipes').select('*').eq('nutricionista_id', nutricionistaId).order('name')
    setRecipes(data || [])
  }, [nutricionistaId, demoPlan])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  const saveMealAsRecipe = async (mealId: string, name: string) => {
    if (!name.trim()) { toast('Ponle un nombre a la receta', 'warn'); return }
    const meal = meals.find(m => m.id === mealId)
    if (!meal || meal.items.length === 0) { toast('Añade algún alimento antes de guardar la receta', 'warn'); return }
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); setSavingRecipeFor(null); setRecipeNameDraft(''); return }
    const { error } = await supabase.from('recipes').insert({
      nutricionista_id: nutricionistaId, name: name.trim(), items: meal.items,
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`Receta "${name.trim()}" guardada ✓`, 'ok')
    setSavingRecipeFor(null); setRecipeNameDraft('')
    await loadRecipes()
  }

  const insertRecipe = (mealId: string, recipe: RecipeRow) => {
    const items = (recipe.items as EditableItem[] | null) || []
    const meal = meals.find(m => m.id === mealId)
    if (!meal) return
    updateMeal(mealId, { items: [...meal.items, ...items.map(i => ({ ...i, id: newId() }))] })
    toast(`Receta "${recipe.name}" insertada ✓`, 'ok')
  }

  const deleteRecipe = async (id: string) => {
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setRecipes(prev => prev.filter(r => r.id !== id))
    await supabase.from('recipes').delete().eq('id', id)
  }

  const loadTemplates = useCallback(async () => {
    if (demoPlan) return
    const { data } = await supabase.from('diet_templates').select('*').eq('nutricionista_id', nutricionistaId)
    setTemplates(data || [])
  }, [nutricionistaId, demoPlan])

  const loadPlan = useCallback(async () => {
    if (demoPlan) return
    setLoading(true)
    const { data: planRow } = await supabase.from('diet_plans').select('*').eq('client_id', client.id).eq('is_active', true).maybeSingle()
    if (!planRow) {
      setPlanId(null); setMeals([]); setSupplements([])
      setKcalTarget(''); setProteinG(''); setCarbsG(''); setFatG(''); setAdvice('')
      setLoading(false)
      return
    }
    const [{ data: mealRows }, { data: supRows }] = await Promise.all([
      supabase.from('diet_meals').select('*').eq('plan_id', planRow.id).order('sort_order'),
      supabase.from('diet_supplements').select('*').eq('plan_id', planRow.id),
    ])
    let itemRows: DietMealItemRow[] = []
    if (mealRows?.length) {
      const { data } = await supabase.from('diet_meal_items').select('*').in('meal_id', mealRows.map((m: DietMealRow) => m.id)).order('sort_order')
      itemRows = data || []
    }
    setPlanId(planRow.id)
    setKcalTarget(String(planRow.kcal_target ?? ''))
    setProteinG(String(planRow.protein_g ?? ''))
    setCarbsG(String(planRow.carbs_g ?? ''))
    setFatG(String(planRow.fat_g ?? ''))
    setAdvice(planRow.advice || '')
    setMeals((mealRows || []).map((m: DietMealRow) => ({
      id: m.id, name: m.name, time: m.time, kcalTarget: m.kcal_target != null ? String(m.kcal_target) : '',
      items: itemRows.filter(i => i.meal_id === m.id).map(i => ({
        id: i.id, foodName: i.food_name, quantity: i.quantity, unit: i.unit,
        kcal: i.kcal != null ? String(i.kcal) : '', proteinG: i.protein_g != null ? String(i.protein_g) : '',
        carbsG: i.carbs_g != null ? String(i.carbs_g) : '', fatG: i.fat_g != null ? String(i.fat_g) : '',
      })),
    })))
    setSupplements((supRows || []).map((s: DietSupplementRow) => ({
      id: s.id, name: s.name, dose: s.dose, timing: s.timing, visibleToClient: s.visible_to_client,
    })))
    setLoading(false)
  }, [client.id, demoPlan])

  useEffect(() => { loadPlan(); loadTemplates() }, [loadPlan, loadTemplates])

  const handleCreatePlan = async () => {
    const { error } = await supabase.from('diet_plans').insert({
      client_id: client.id, nutricionista_id: nutricionistaId, name: 'Plan de dieta',
      kcal_target: 0, protein_g: 0, carbs_g: 0, fat_g: 0, advice: '', is_active: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    await loadPlan()
  }

  const handleSave = async () => {
    if (!planId) return
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setSaving(true)
    await supabase.from('diet_plans').update({
      kcal_target: parseFloat(kcalTarget) || 0, protein_g: parseFloat(proteinG) || 0,
      carbs_g: parseFloat(carbsG) || 0, fat_g: parseFloat(fatG) || 0,
      advice, updated_at: new Date().toISOString(),
    }).eq('id', planId)

    await supabase.from('diet_meals').delete().eq('plan_id', planId)
    await supabase.from('diet_supplements').delete().eq('plan_id', planId)

    for (let idx = 0; idx < meals.length; idx++) {
      const meal = meals[idx]
      const { data: insertedMeal } = await supabase.from('diet_meals').insert({
        plan_id: planId, name: meal.name, time: meal.time,
        kcal_target: meal.kcalTarget ? parseFloat(meal.kcalTarget) : null, sort_order: idx,
      }).select().single()
      if (insertedMeal && meal.items.length) {
        await supabase.from('diet_meal_items').insert(meal.items.map((item, i) => ({
          meal_id: insertedMeal.id, food_name: item.foodName, quantity: item.quantity, unit: item.unit,
          kcal: item.kcal ? parseFloat(item.kcal) : null, protein_g: item.proteinG ? parseFloat(item.proteinG) : null,
          carbs_g: item.carbsG ? parseFloat(item.carbsG) : null, fat_g: item.fatG ? parseFloat(item.fatG) : null, sort_order: i,
        })))
      }
    }
    if (supplements.length) {
      await supabase.from('diet_supplements').insert(supplements.map(s => ({
        plan_id: planId, name: s.name, dose: s.dose, timing: s.timing, visible_to_client: s.visibleToClient,
      })))
    }
    setSaving(false)
    toast('Plan de dieta guardado ✓', 'ok')
    sendPush({ clientId: client.id }, 'Tu plan de dieta se ha actualizado 🥗', 'Tu nutricionista ha actualizado tu plan — échale un vistazo.')
    await loadPlan()
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { toast('Ponle un nombre a la plantilla', 'warn'); return }
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); setTemplateName(''); return }
    const { error } = await supabase.from('diet_templates').insert({
      nutricionista_id: nutricionistaId, name: templateName.trim(),
      plan: {
        kcalTarget: parseFloat(kcalTarget) || 0, proteinG: parseFloat(proteinG) || 0,
        carbsG: parseFloat(carbsG) || 0, fatG: parseFloat(fatG) || 0, advice,
        meals: meals.map(m => ({ name: m.name, time: m.time, kcalTarget: m.kcalTarget, items: m.items })),
        supplements: supplements.map(s => ({ name: s.name, dose: s.dose, timing: s.timing, visibleToClient: s.visibleToClient })),
      },
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast('Plantilla guardada ✓', 'ok')
    setTemplateName('')
    await loadTemplates()
  }

  const applyTemplate = (tpl: DietTemplateRow) => {
    const p = tpl.plan as any
    setKcalTarget(String(p.kcalTarget ?? '')); setProteinG(String(p.proteinG ?? ''))
    setCarbsG(String(p.carbsG ?? '')); setFatG(String(p.fatG ?? '')); setAdvice(p.advice || '')
    setMeals((p.meals || []).map((m: any) => ({
      id: newId(), name: m.name, time: m.time, kcalTarget: m.kcalTarget || '',
      items: (m.items || []).map((i: any) => ({ ...i, id: newId() })),
    })))
    setSupplements((p.supplements || []).map((s: any) => ({ ...s, id: newId() })))
    toast(`Plantilla "${tpl.name}" aplicada — recuerda guardar`, 'ok')
  }

  const addMeal = () => setMeals([...meals, { id: newId(), name: 'Comida', time: '', kcalTarget: '', items: [] }])
  const removeMeal = (id: string) => setMeals(meals.filter(m => m.id !== id))
  const updateMeal = (id: string, updates: Partial<EditableMeal>) => setMeals(meals.map(m => m.id === id ? { ...m, ...updates } : m))
  const addItem = (mealId: string) => updateMeal(mealId, {
    items: [...(meals.find(m => m.id === mealId)?.items || []), { id: newId(), foodName: '', quantity: '', unit: '', kcal: '', proteinG: '', carbsG: '', fatG: '' }],
  })
  const removeItem = (mealId: string, itemId: string) => {
    const meal = meals.find(m => m.id === mealId)
    if (!meal) return
    updateMeal(mealId, { items: meal.items.filter(i => i.id !== itemId) })
  }
  const updateItem = (mealId: string, itemId: string, updates: Partial<EditableItem>) => {
    const meal = meals.find(m => m.id === mealId)
    if (!meal) return
    updateMeal(mealId, { items: meal.items.map(i => i.id === itemId ? { ...i, ...updates } : i) })
  }
  const selectFood = (mealId: string, itemId: string, food: Food) => {
    updateItem(mealId, itemId, {
      foodName: food.name, quantity: '100', unit: 'g',
      kcal: String(food.kcal), proteinG: String(food.proteinG), carbsG: String(food.carbsG), fatG: String(food.fatG),
    })
    setOpenSuggestFor(null)
  }

  const addSupplement = () => setSupplements([...supplements, { id: newId(), name: '', dose: '', timing: '', visibleToClient: true }])
  const removeSupplement = (id: string) => setSupplements(supplements.filter(s => s.id !== id))
  const updateSupplement = (id: string, updates: Partial<EditableSupplement>) => setSupplements(supplements.map(s => s.id === id ? { ...s, ...updates } : s))

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  if (!planId) return (
    <div className="bg-card border border-border rounded-2xl p-12 text-center max-w-lg">
      <p className="text-muted text-sm mb-4">Este cliente no tiene plan de dieta activo.</p>
      <Button onClick={handleCreatePlan}>Crear plan de dieta</Button>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {templates.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Aplicar plantilla:</span>
          {templates.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t)}
              className="px-3 py-1.5 bg-bg-alt rounded-lg text-xs font-medium hover:bg-accent/10 hover:text-accent transition-colors">
              {t.name}
            </button>
          ))}
        </div>
      )}

      {recipes.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5"><ChefHat className="w-3.5 h-3.5" /> Tu recetario ({recipes.length})</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {recipes.map(r => (
              <span key={r.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-bg-alt rounded-lg text-xs font-medium">
                {r.name}
                <button onClick={() => deleteRecipe(r.id)} className="p-0.5 text-muted hover:text-warn" title="Eliminar receta"><Trash2 className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-sm">Objetivo de macros</p>
        <div className="grid grid-cols-4 gap-3">
          <NumInput label="Kcal" value={kcalTarget} onChange={setKcalTarget} />
          <NumInput label="Proteína (g)" value={proteinG} onChange={setProteinG} />
          <NumInput label="Carbos (g)" value={carbsG} onChange={setCarbsG} />
          <NumInput label="Grasas (g)" value={fatG} onChange={setFatG} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Consejo del nutricionista</label>
          <textarea value={advice} onChange={e => setAdvice(e.target.value)} rows={2}
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Comidas</p>
          <button onClick={addMeal} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir comida</button>
        </div>
        {meals.map(meal => (
          <div key={meal.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input value={meal.name} onChange={e => updateMeal(meal.id, { name: e.target.value })} placeholder="Nombre (ej. Desayuno)"
                className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
              <input type="time" value={meal.time} onChange={e => updateMeal(meal.id, { time: e.target.value })}
                className="w-28 px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
              <input type="number" value={meal.kcalTarget} onChange={e => updateMeal(meal.id, { kcalTarget: e.target.value })} placeholder="Kcal"
                className="w-20 px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
              <button onClick={() => removeMeal(meal.id)} className="p-2 text-muted hover:text-warn"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {meal.items.map(item => {
                const allergenHit = detectAllergenConflict(client.allergies, item.foodName)
                const suggestions = openSuggestFor === item.id && item.foodName.trim().length > 0
                  ? foods.filter(f => f.name.toLowerCase().includes(item.foodName.toLowerCase())).slice(0, 6)
                  : []
                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input value={item.foodName}
                        onChange={e => updateItem(meal.id, item.id, { foodName: e.target.value })}
                        onFocus={() => setOpenSuggestFor(item.id)}
                        onBlur={() => setTimeout(() => setOpenSuggestFor(null), 150)}
                        placeholder="Alimento"
                        className="w-full px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                      {suggestions.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {suggestions.map(f => (
                            <button key={f.id} type="button" onMouseDown={() => selectFood(meal.id, item.id, f)}
                              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                              <span>{f.name}</span>
                              <span className="text-muted flex-shrink-0">{f.kcal} kcal/100g</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input value={item.quantity} onChange={e => updateItem(meal.id, item.id, { quantity: e.target.value })} placeholder="Cant."
                      className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    <input value={item.unit} onChange={e => updateItem(meal.id, item.id, { unit: e.target.value })} placeholder="Unidad"
                      className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                    {allergenHit && (
                      <span title={`Posible alérgeno para este cliente: ${allergenHit.replace('_', ' ')}`} className="flex-shrink-0 text-warn">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <button onClick={() => removeItem(meal.id, item.id)} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )
              })}
              <button onClick={() => addItem(meal.id)} className="flex items-center gap-1 text-xs text-muted hover:text-accent"><Plus className="w-3 h-3" /> Añadir alimento</button>
            </div>

            <div className="pt-2 border-t border-border flex items-center gap-2 flex-wrap">
              {recipes.length > 0 && (
                <select defaultValue="" onChange={e => {
                  const recipe = recipes.find(r => r.id === e.target.value)
                  if (recipe) insertRecipe(meal.id, recipe)
                  e.target.value = ''
                }} className="px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
                  <option value="" disabled>Insertar receta...</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              {savingRecipeFor === meal.id ? (
                <>
                  <input value={recipeNameDraft} onChange={e => setRecipeNameDraft(e.target.value)} placeholder="Nombre de la receta" autoFocus
                    className="px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20 w-40" />
                  <button onClick={() => saveMealAsRecipe(meal.id, recipeNameDraft)} className="px-2.5 py-1.5 bg-ink text-white rounded-lg text-xs font-semibold">Guardar</button>
                  <button onClick={() => { setSavingRecipeFor(null); setRecipeNameDraft('') }} className="text-xs text-muted hover:text-warn">Cancelar</button>
                </>
              ) : (
                <button onClick={() => { setSavingRecipeFor(meal.id); setRecipeNameDraft(meal.name) }}
                  className="flex items-center gap-1 text-xs text-muted hover:text-accent">
                  <ChefHat className="w-3.5 h-3.5" /> Guardar esta comida como receta
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Suplementación</p>
          <button onClick={addSupplement} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir</button>
        </div>
        {supplements.map(sup => (
          <div key={sup.id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-2">
            <input value={sup.name} onChange={e => updateSupplement(sup.id, { name: e.target.value })} placeholder="Nombre"
              className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={sup.dose} onChange={e => updateSupplement(sup.id, { dose: e.target.value })} placeholder="Dosis"
              className="w-24 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={sup.timing} onChange={e => updateSupplement(sup.id, { timing: e.target.value })} placeholder="Cuándo"
              className="w-24 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            <button onClick={() => updateSupplement(sup.id, { visibleToClient: !sup.visibleToClient })}
              className="p-1.5 text-muted hover:text-ink" title={sup.visibleToClient ? 'Visible para el cliente' : 'Oculto para el cliente'}>
              {sup.visibleToClient ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => removeSupplement(sup.id)} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSave} loading={saving}>Guardar plan</Button>
        <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nombre de la plantilla"
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20 w-48" />
        <Button variant="outline" onClick={handleSaveTemplate}><BookmarkPlus className="w-3.5 h-3.5" /> Guardar como plantilla</Button>
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
    </div>
  )
}
