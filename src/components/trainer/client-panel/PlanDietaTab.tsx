import { useState, useEffect, useCallback } from 'react'
import { ClientData, DietPlan, Food } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { DietMealRow, DietMealItemRow, DietSupplementRow, DietTemplateRow, RecipeRow } from '../../../lib/supabase-types'
import { foodFromRow } from '../../../lib/mappers'
import { detectAllergenConflict } from '../../../lib/allergens'
import { DietaryTag, DIETARY_TAG_LABELS, classifyFoodTags, foodMatchesTags } from '../../../lib/dietaryTags'
import { sendPush } from '../../../lib/usePushNotifications'
import { DEMO_DIET_TEMPLATES, DEMO_RECIPES } from '../../../lib/demo-data'
import { printDietPlan } from '../../../lib/printPlan'
import { printRecipeBook } from '../../../lib/printRecipeBook'
import { ScannedFood } from '../../../lib/openFoodFacts'
import { gramsForAbsoluteMacro, computeMacros, rankSubstitutesByMacros, MacroKey } from '../../../lib/foodConversion'
import { buildShoppingList } from '../../../lib/shoppingList'
import { buildWAUrl } from '../../../lib/whatsapp'
import {
  Sex, Formula, ActivityLevel, Goal, ACTIVITY_LABELS, GOAL_LABELS,
  computeMetabolicPlan, ageFromBirthDate,
} from '../../../lib/metabolicCalculator'
import { Button } from '../../shared/Button'
import { BarcodeScanner } from '../../shared/BarcodeScanner'
import { RecipePhotoUpload } from '../../shared/RecipePhotoUpload'
import { RecipeEditorPanel } from '../../shared/RecipeEditorPanel'
import { toast } from '../../shared/Toast'
import { FoodConverterDrawer } from '../FoodConverterDrawer'
import { ImportDietPlanModal } from './ImportDietPlanModal'
import {
  Plus, Trash2, Eye, EyeOff, BookmarkPlus, AlertTriangle, ChefHat, Download, Barcode, FlaskConical,
  ChevronDown, ChevronUp, Copy, Repeat, BookOpen, Calculator, X, ShoppingCart, Check, Send, Layers, FileSpreadsheet,
} from 'lucide-react'

export interface EditableItem {
  id: string; foodName: string; quantity: string; unit: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
  fiberG: string; sugarG: string; sodiumMg: string; saturatedFatG: string
  calciumMg: string; ironMg: string; zincMg: string
  recipeId?: string | null
}
// 0=lunes...6=domingo. null = todos los días (comportamiento anterior al
// cuadrante semanal — los planes ya creados siguen así hasta que se les
// asigne un día concreto a alguna comida).
export interface EditableMeal {
  id: string; name: string; time: string; kcalTarget: string; dayOfWeek: number | null
  optionGroup: string | null; optionLabel: string | null
  dayType: 'on' | 'off' | null
  items: EditableItem[]
}
interface EditableSupplement { id: string; name: string; dose: string; timing: string; visibleToClient: boolean }

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function newId() { return crypto.randomUUID() }

const MACRO_LABELS: Record<MacroKey, string> = { kcal: 'kcal', proteinG: 'proteína', carbsG: 'carbohidratos', fatG: 'grasas' }

/** Suma de macros de una comida/receta completa — la "calculadora de recetas":
 * a partir de los alimentos individuales, el total nutricional del plato. */
function sumItemMacros(items: EditableItem[]) {
  return items.reduce((acc, i) => ({
    kcal: acc.kcal + (parseFloat(i.kcal) || 0),
    proteinG: acc.proteinG + (parseFloat(i.proteinG) || 0),
    carbsG: acc.carbsG + (parseFloat(i.carbsG) || 0),
    fatG: acc.fatG + (parseFloat(i.fatG) || 0),
    fiberG: acc.fiberG + (parseFloat(i.fiberG) || 0),
  }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
}

/** Suma de macros de un conjunto de comidas — para las barras de progreso
 * "objetivo vs. lo sumado en las comidas". Cada comida cuenta una sola vez:
 * quien llama debe pasar ya solo una comida por hueco (p.ej. una por grupo
 * de opciones intercambiables), no todas las alternativas a la vez. */
function sumMealsMacros(meals: EditableMeal[]) {
  return meals.reduce((acc, m) => {
    const t = sumItemMacros(m.items)
    return { kcal: acc.kcal + t.kcal, proteinG: acc.proteinG + t.proteinG, carbsG: acc.carbsG + t.carbsG, fatG: acc.fatG + t.fatG, fiberG: acc.fiberG + t.fiberG }
  }, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
}

const SCALABLE_ITEM_FIELDS: (keyof EditableItem)[] = [
  'quantity', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg', 'saturatedFatG', 'calciumMg', 'ironMg', 'zincMg',
]

/** Escala una receta entera (todos los ingredientes) a un objetivo de kcal,
 * multiplicando cada gramaje por el mismo factor — al escalar todo por igual,
 * las proporciones de macros se mantienen automáticamente. Es el "escalado
 * automático por tramo calórico": la misma receta sirve para un objetivo de
 * 400, 600 u 800 kcal sin tener que rehacerla a mano. */
function scaleRecipeToKcal(items: EditableItem[], targetKcal: number): EditableItem[] {
  const currentKcal = items.reduce((sum, i) => sum + (parseFloat(i.kcal) || 0), 0)
  if (currentKcal <= 0) return items.map(i => ({ ...i, id: newId() }))
  const factor = targetKcal / currentKcal
  return items.map(item => {
    const scaled: EditableItem = { ...item, id: newId() }
    for (const field of SCALABLE_ITEM_FIELDS) {
      const raw = item[field]
      if (raw) {
        const num = parseFloat(raw)
        if (!isNaN(num)) scaled[field] = String(Math.round(num * factor * 10) / 10)
      }
    }
    return scaled
  })
}

function demoPlanToEditable(plan: DietPlan) {
  return {
    kcalTarget: String(plan.kcalTarget), proteinG: String(plan.proteinG),
    carbsG: String(plan.carbsG), fatG: String(plan.fatG), fiberG: String(plan.fiberG), advice: plan.advice,
    meals: plan.meals.map(m => ({
      id: m.id, name: m.name, time: m.time, kcalTarget: m.kcalTarget != null ? String(m.kcalTarget) : '',
      dayOfWeek: m.dayOfWeek ?? null, optionGroup: m.optionGroup ?? null, optionLabel: m.optionLabel ?? null,
      dayType: m.dayType ?? null,
      items: m.items.map(i => ({
        id: i.id, foodName: i.foodName, quantity: i.quantity, unit: i.unit,
        kcal: i.kcal != null ? String(i.kcal) : '', proteinG: i.proteinG != null ? String(i.proteinG) : '',
        carbsG: i.carbsG != null ? String(i.carbsG) : '', fatG: i.fatG != null ? String(i.fatG) : '',
        fiberG: i.fiberG != null ? String(i.fiberG) : '', sugarG: i.sugarG != null ? String(i.sugarG) : '',
        sodiumMg: i.sodiumMg != null ? String(i.sodiumMg) : '', saturatedFatG: i.saturatedFatG != null ? String(i.saturatedFatG) : '',
        calciumMg: i.calciumMg != null ? String(i.calciumMg) : '', ironMg: i.ironMg != null ? String(i.ironMg) : '',
        zincMg: i.zincMg != null ? String(i.zincMg) : '', recipeId: i.recipeId ?? null,
      })),
    })),
    supplements: plan.supplements.map(s => ({ id: s.id, name: s.name, dose: s.dose, timing: s.timing, visibleToClient: s.visibleToClient })),
  }
}

export function PlanDietaTab({ client, nutricionistaId, nutricionistaName, nutricionistaLogoUrl, nutricionistaAccentColor, demoPlan, personalMode }: {
  client: ClientData; nutricionistaId: string; nutricionistaName?: string
  nutricionistaLogoUrl?: string | null; nutricionistaAccentColor?: string | null
  demoPlan?: DietPlan
  // true en modo personal (ver PersonalModeShell) — el "cliente" es quien
  // está usando la pantalla, así que los textos en tercera persona
  // ("este cliente", "para el cliente") se cambian a segunda persona.
  personalMode?: boolean
}) {
  const demoEditable = demoPlan ? demoPlanToEditable(demoPlan) : null
  const [loading, setLoading] = useState(!demoPlan)
  const [saving, setSaving] = useState(false)
  const [planId, setPlanId] = useState<string | null>(demoPlan ? demoPlan.id : null)
  const [kcalTarget, setKcalTarget] = useState(demoEditable?.kcalTarget ?? '')
  const [proteinG, setProteinG] = useState(demoEditable?.proteinG ?? '')
  const [carbsG, setCarbsG] = useState(demoEditable?.carbsG ?? '')
  const [fatG, setFatG] = useState(demoEditable?.fatG ?? '')
  const [fiberG, setFiberG] = useState(demoEditable?.fiberG ?? '')
  const [advice, setAdvice] = useState(demoEditable?.advice ?? '')
  const [meals, setMeals] = useState<EditableMeal[]>(demoEditable?.meals ?? [])
  const [supplements, setSupplements] = useState<EditableSupplement[]>(demoEditable?.supplements ?? [])
  const [templates, setTemplates] = useState<DietTemplateRow[]>([])
  const [showCalculator, setShowCalculator] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [openSuggestFor, setOpenSuggestFor] = useState<string | null>(null)
  // Pills de filtro dietoterapéutico (sin gluten, bajo FODMAP...) — un único
  // filtro compartido por el buscador de "añadir alimento" y el de
  // "sustituir", así el nutricionista no tiene que repetir la selección.
  const [activeFoodTags, setActiveFoodTags] = useState<DietaryTag[]>([])
  const toggleFoodTag = (tag: DietaryTag) =>
    setActiveFoodTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [savingRecipeFor, setSavingRecipeFor] = useState<string | null>(null)
  const [recipeNameDraft, setRecipeNameDraft] = useState('')
  const [editingRecipe, setEditingRecipe] = useState<RecipeRow | null>(null)

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

  const loadRecipes = useCallback(async () => {
    if (demoPlan) { setRecipes(DEMO_RECIPES); return }
    // Propias + recetas del sistema (nutricionista_id null) — el punto de
    // partida además de las tuyas, no en sustitución.
    const { data } = await supabase.from('recipes').select('*')
      .or(`nutricionista_id.eq.${nutricionistaId},nutricionista_id.is.null`).order('name')
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
    const rawItems = (recipe.items as EditableItem[] | null) || []
    const meal = meals.find(m => m.id === mealId)
    if (!meal) return
    // Constructor de menú por tramo calórico: si la comida ya tiene un
    // objetivo de kcal, la receta se escala sola al hueco que queda (target
    // menos lo que ya hay puesto), en vez de insertarse a su tamaño original.
    const mealTarget = parseFloat(meal.kcalTarget)
    const alreadyUsed = sumItemMacros(meal.items).kcal
    const remaining = mealTarget - alreadyUsed
    const shouldScale = !isNaN(mealTarget) && mealTarget > 0 && remaining > 0
    const scaled = shouldScale ? scaleRecipeToKcal(rawItems, remaining) : rawItems.map(i => ({ ...i, id: newId() }))
    // Se etiqueta cada ítem con la receta de origen (no la trae el jsonb de
    // la receta en sí) para poder filtrar el recetario dinámico a solo las
    // recetas realmente usadas en este plan.
    const items = scaled.map(i => ({ ...i, recipeId: recipe.id }))
    updateMeal(mealId, { items: [...meal.items, ...items] })
    toast(shouldScale
      ? `Receta "${recipe.name}" insertada y ajustada a ${Math.round(remaining)} kcal ✓`
      : `Receta "${recipe.name}" insertada ✓`, 'ok')
  }

  const deleteRecipe = async (id: string) => {
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setRecipes(prev => prev.filter(r => r.id !== id))
    await supabase.from('recipes').delete().eq('id', id)
  }

  const copyRecipe = async (recipe: RecipeRow) => {
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    const { error } = await supabase.from('recipes').insert({
      nutricionista_id: nutricionistaId, name: `${recipe.name} (copia)`, items: recipe.items,
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`"${recipe.name}" copiada a tus recetas ✓`, 'ok')
    await loadRecipes()
  }

  const setRecipePhoto = async (recipe: RecipeRow, url: string) => {
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, photo_url: url || null } : r))
    await supabase.from('recipes').update({ photo_url: url || null }).eq('id', recipe.id)
  }

  const loadTemplates = useCallback(async () => {
    if (demoPlan) { setTemplates(DEMO_DIET_TEMPLATES); return }
    const { data } = await supabase.from('diet_templates').select('*').eq('nutricionista_id', nutricionistaId)
    setTemplates(data || [])
  }, [nutricionistaId, demoPlan])

  const loadPlan = useCallback(async () => {
    if (demoPlan) return
    setLoading(true)
    const { data: planRow } = await supabase.from('diet_plans').select('*').eq('client_id', client.id).eq('is_active', true).maybeSingle()
    if (!planRow) {
      setPlanId(null); setMeals([]); setSupplements([])
      setKcalTarget(''); setProteinG(''); setCarbsG(''); setFatG(''); setFiberG(''); setAdvice('')
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
    setFiberG(String(planRow.fiber_g ?? ''))
    setAdvice(planRow.advice || '')
    setMeals((mealRows || []).map((m: DietMealRow) => ({
      id: m.id, name: m.name, time: m.time, kcalTarget: m.kcal_target != null ? String(m.kcal_target) : '',
      dayOfWeek: m.day_of_week, optionGroup: m.option_group, optionLabel: m.option_label, dayType: m.day_type,
      items: itemRows.filter(i => i.meal_id === m.id).map(i => ({
        id: i.id, foodName: i.food_name, quantity: i.quantity, unit: i.unit,
        kcal: i.kcal != null ? String(i.kcal) : '', proteinG: i.protein_g != null ? String(i.protein_g) : '',
        carbsG: i.carbs_g != null ? String(i.carbs_g) : '', fatG: i.fat_g != null ? String(i.fat_g) : '',
        fiberG: i.fiber_g != null ? String(i.fiber_g) : '', sugarG: i.sugar_g != null ? String(i.sugar_g) : '',
        sodiumMg: i.sodium_mg != null ? String(i.sodium_mg) : '', saturatedFatG: i.saturated_fat_g != null ? String(i.saturated_fat_g) : '',
        calciumMg: i.calcium_mg != null ? String(i.calcium_mg) : '', ironMg: i.iron_mg != null ? String(i.iron_mg) : '',
        zincMg: i.zinc_mg != null ? String(i.zinc_mg) : '', recipeId: i.recipe_id,
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
      kcal_target: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, advice: '', is_active: true,
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
      carbs_g: parseFloat(carbsG) || 0, fat_g: parseFloat(fatG) || 0, fiber_g: parseFloat(fiberG) || 0,
      advice, updated_at: new Date().toISOString(),
    }).eq('id', planId)

    await supabase.from('diet_meals').delete().eq('plan_id', planId)
    await supabase.from('diet_supplements').delete().eq('plan_id', planId)

    for (let idx = 0; idx < meals.length; idx++) {
      const meal = meals[idx]
      const { data: insertedMeal } = await supabase.from('diet_meals').insert({
        plan_id: planId, name: meal.name, time: meal.time,
        kcal_target: meal.kcalTarget ? parseFloat(meal.kcalTarget) : null, day_of_week: meal.dayOfWeek,
        option_group: meal.optionGroup, option_label: meal.optionLabel, day_type: meal.dayType, sort_order: idx,
      }).select().single()
      if (insertedMeal && meal.items.length) {
        await supabase.from('diet_meal_items').insert(meal.items.map((item, i) => ({
          meal_id: insertedMeal.id, food_name: item.foodName, quantity: item.quantity, unit: item.unit,
          kcal: item.kcal ? parseFloat(item.kcal) : null, protein_g: item.proteinG ? parseFloat(item.proteinG) : null,
          carbs_g: item.carbsG ? parseFloat(item.carbsG) : null, fat_g: item.fatG ? parseFloat(item.fatG) : null,
          fiber_g: item.fiberG ? parseFloat(item.fiberG) : null, sugar_g: item.sugarG ? parseFloat(item.sugarG) : null,
          sodium_mg: item.sodiumMg ? parseFloat(item.sodiumMg) : null, saturated_fat_g: item.saturatedFatG ? parseFloat(item.saturatedFatG) : null,
          calcium_mg: item.calciumMg ? parseFloat(item.calciumMg) : null, iron_mg: item.ironMg ? parseFloat(item.ironMg) : null,
          zinc_mg: item.zincMg ? parseFloat(item.zincMg) : null, recipe_id: item.recipeId || null,
          sort_order: i,
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

  const handlePrint = () => {
    const printable: DietPlan = {
      id: planId || '', clientId: client.id, nutricionistaId, name: 'Plan de dieta',
      kcalTarget: parseFloat(kcalTarget) || 0, proteinG: parseFloat(proteinG) || 0,
      carbsG: parseFloat(carbsG) || 0, fatG: parseFloat(fatG) || 0, fiberG: parseFloat(fiberG) || 0, advice, isActive: true,
      meals: meals.map(m => ({
        id: m.id, name: m.name, time: m.time, kcalTarget: m.kcalTarget ? parseFloat(m.kcalTarget) : null,
        dayOfWeek: m.dayOfWeek as DietPlan['meals'][number]['dayOfWeek'],
        optionGroup: m.optionGroup, optionLabel: m.optionLabel, dayType: m.dayType,
        items: m.items.map(i => ({ id: i.id, foodName: i.foodName, quantity: i.quantity, unit: i.unit, kcal: null, proteinG: null, carbsG: null, fatG: null })),
      })),
      supplements: supplements.map(s => ({ id: s.id, name: s.name, dose: s.dose, timing: s.timing, visibleToClient: s.visibleToClient })),
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    printDietPlan(client, printable, { logoUrl: nutricionistaLogoUrl, accentColor: nutricionistaAccentColor })
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { toast('Ponle un nombre a la plantilla', 'warn'); return }
    if (demoPlan) { toast('Modo demo: los cambios no se guardan', 'ok'); setTemplateName(''); return }
    const { error } = await supabase.from('diet_templates').insert({
      nutricionista_id: nutricionistaId, name: templateName.trim(),
      plan: {
        kcalTarget: parseFloat(kcalTarget) || 0, proteinG: parseFloat(proteinG) || 0,
        carbsG: parseFloat(carbsG) || 0, fatG: parseFloat(fatG) || 0, fiberG: parseFloat(fiberG) || 0, advice,
        meals: meals.map(m => ({
          name: m.name, time: m.time, kcalTarget: m.kcalTarget, dayOfWeek: m.dayOfWeek,
          optionGroup: m.optionGroup, optionLabel: m.optionLabel, dayType: m.dayType, items: m.items,
        })),
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
    setCarbsG(String(p.carbsG ?? '')); setFatG(String(p.fatG ?? '')); setFiberG(String(p.fiberG ?? ''))
    setAdvice(p.advice || '')
    setMeals((p.meals || []).map((m: any) => ({
      id: newId(), name: m.name, time: m.time, kcalTarget: m.kcalTarget || '', dayOfWeek: m.dayOfWeek ?? null,
      optionGroup: m.optionGroup ?? null, optionLabel: m.optionLabel ?? null, dayType: m.dayType ?? null,
      items: (m.items || []).map((i: any) => ({ ...i, id: newId() })),
    })))
    setSupplements((p.supplements || []).map((s: any) => ({ ...s, id: newId() })))
    toast(`Plantilla "${tpl.name}" aplicada — recuerda guardar`, 'ok')
  }

  // ── Cuadrante semanal ─────────────────────────────────────────
  // 'all' = pestaña "Todos los días" (comidas con dayOfWeek null).
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all')
  const [copyFromDay, setCopyFromDay] = useState('')

  // ── Carb cycling (día ON/OFF) ──────────────────────────────────
  // 'all' = ver las comidas de ambos tipos de día a la vez (para editarlas);
  // solo importa para calcular la suma de macros del día, que si no doblaría
  // ON+OFF como si se comieran las dos el mismo día.
  const [selectedDayType, setSelectedDayType] = useState<'all' | 'on' | 'off'>('all')
  const usesCarbCycling = meals.some(m => m.dayType != null)

  const visibleMeals = meals.filter(m => selectedDay === 'all' ? m.dayOfWeek == null : (m.dayOfWeek === selectedDay || m.dayOfWeek == null))
  const usesWeeklyMenu = meals.some(m => m.dayOfWeek != null)
  // En "Cualquiera" no tiene sentido sumar la variante ON y la OFF de la
  // misma comida a la vez (se contaría dos veces un mismo hueco) — así que
  // ahí solo cuentan las comidas sin dayType (las que aplican cualquier
  // día); hay que elegir ON u OFF para ver el total de ese tipo de día.
  const macroMeals = selectedDayType === 'all' ? visibleMeals.filter(m => m.dayType == null) : visibleMeals.filter(m => m.dayType === selectedDayType || m.dayType == null)
  // Agrupa visibleMeals por optionGroup para la pauta flexible por opciones
  // — cada grupo es un array de 1+ comidas; las comidas con optionGroup null
  // forman su propio grupo de 1 (comportamiento normal, sin cambios visuales).
  // Mantiene el orden de aparición de visibleMeals.
  const mealGroups: EditableMeal[][] = []
  {
    const groupsByOptionId = new Map<string, EditableMeal[]>()
    for (const m of visibleMeals) {
      if (m.optionGroup) {
        let group = groupsByOptionId.get(m.optionGroup)
        if (!group) { group = []; groupsByOptionId.set(m.optionGroup, group); mealGroups.push(group) }
        group.push(m)
      } else {
        mealGroups.push([m])
      }
    }
  }

  const copyDayMeals = () => {
    if (copyFromDay === '' || selectedDay === 'all') return
    const sourceDay = parseInt(copyFromDay, 10)
    const sourceMeals = meals.filter(m => m.dayOfWeek === sourceDay)
    if (sourceMeals.length === 0) { toast('Ese día no tiene comidas todavía', 'warn'); return }
    // Si el día copiado tiene comidas agrupadas como opciones, hay que darles
    // un optionGroup nuevo (distinto del original) mantiendo agrupadas entre
    // sí las que ya lo estaban — si no, la copia compartiría grupo con el
    // día de origen sin que tenga sentido (son días distintos).
    const groupIdMap = new Map<string, string>()
    const copied = sourceMeals.map(m => ({
      ...m, id: newId(), dayOfWeek: selectedDay as number,
      optionGroup: m.optionGroup ? (groupIdMap.get(m.optionGroup) ?? groupIdMap.set(m.optionGroup, newId()).get(m.optionGroup)!) : null,
      items: m.items.map(i => ({ ...i, id: newId() })),
    }))
    setMeals([...meals, ...copied])
    setCopyFromDay('')
    toast(`${copied.length} comida${copied.length === 1 ? '' : 's'} copiada${copied.length === 1 ? '' : 's'} de ${DAY_LABELS[sourceDay]} ✓`, 'ok')
  }

  const addOption = (meal: EditableMeal) => {
    const groupId = meal.optionGroup || newId()
    const siblings = meal.optionGroup ? meals.filter(m => m.optionGroup === groupId) : [meal]
    const nextLetter = String.fromCharCode(65 + siblings.length) // A=65 → B, C, D...
    const updated = meal.optionGroup ? meals : meals.map(m => m.id === meal.id ? { ...m, optionGroup: groupId, optionLabel: m.optionLabel || 'Opción A' } : m)
    const newOption: EditableMeal = {
      id: newId(), name: meal.name, time: meal.time, kcalTarget: meal.kcalTarget, dayOfWeek: meal.dayOfWeek,
      optionGroup: groupId, optionLabel: `Opción ${nextLetter}`, dayType: meal.dayType, items: [],
    }
    setMeals([...updated, newOption])
  }

  const removeFromOptionGroup = (mealId: string) => {
    setMeals(meals.map(m => m.id === mealId ? { ...m, optionGroup: null, optionLabel: null } : m))
  }

  /** Recetario dinámico: solo las recetas realmente usadas en este plan
   * (identificadas por recipeId en los ítems), con los ingredientes ya
   * escalados a las necesidades de este cliente — no la receta base. */
  const dynamicRecetario = () => {
    const groups = new Map<string, { name: string; photoUrl: string | null; steps: string | null; items: EditableItem[] }>()
    for (const meal of meals) {
      for (const item of meal.items) {
        if (!item.recipeId) continue
        const recipe = recipes.find(r => r.id === item.recipeId)
        if (!recipe) continue
        if (!groups.has(item.recipeId)) groups.set(item.recipeId, { name: recipe.name, photoUrl: recipe.photo_url, steps: recipe.steps, items: [] })
        groups.get(item.recipeId)!.items.push(item)
      }
    }
    return Array.from(groups.values())
  }

  const addMeal = () => setMeals([...meals, {
    id: newId(), name: 'Comida', time: '', kcalTarget: '', dayOfWeek: selectedDay === 'all' ? null : selectedDay,
    optionGroup: null, optionLabel: null, dayType: null, items: [],
  }])
  const removeMeal = (id: string) => setMeals(meals.filter(m => m.id !== id))
  const updateMeal = (id: string, updates: Partial<EditableMeal>) => setMeals(meals.map(m => m.id === id ? { ...m, ...updates } : m))
  const addItem = (mealId: string) => updateMeal(mealId, {
    items: [...(meals.find(m => m.id === mealId)?.items || []), {
      id: newId(), foodName: '', quantity: '', unit: '', kcal: '', proteinG: '', carbsG: '', fatG: '',
      fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '',
    }],
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
      fiberG: food.fiberG != null ? String(food.fiberG) : '', sugarG: food.sugarG != null ? String(food.sugarG) : '',
      sodiumMg: food.sodiumMg != null ? String(food.sodiumMg) : '', saturatedFatG: food.saturatedFatG != null ? String(food.saturatedFatG) : '',
      calciumMg: food.calciumMg != null ? String(food.calciumMg) : '', ironMg: food.ironMg != null ? String(food.ironMg) : '',
      zincMg: food.zincMg != null ? String(food.zincMg) : '',
    })
    setOpenSuggestFor(null)
  }

  const [scanningFor, setScanningFor] = useState<{ mealId: string; itemId: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const handleScanned = (food: ScannedFood) => {
    if (!scanningFor) return
    updateItem(scanningFor.mealId, scanningFor.itemId, {
      foodName: food.name, quantity: '100', unit: 'g',
      kcal: String(food.kcal), proteinG: String(food.proteinG), carbsG: String(food.carbsG), fatG: String(food.fatG),
      fiberG: food.fiberG != null ? String(food.fiberG) : '', sugarG: food.sugarG != null ? String(food.sugarG) : '',
      sodiumMg: food.sodiumMg != null ? String(food.sodiumMg) : '', saturatedFatG: food.saturatedFatG != null ? String(food.saturatedFatG) : '',
      calciumMg: food.calciumMg != null ? String(food.calciumMg) : '', ironMg: food.ironMg != null ? String(food.ironMg) : '',
      zincMg: food.zincMg != null ? String(food.zincMg) : '',
    })
    toast(`"${food.name}" añadido ✓`, 'ok')
    setScanningFor(null)
  }
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const [substitutingFor, setSubstitutingFor] = useState<{ mealId: string; itemId: string } | null>(null)
  const [subMatchBy, setSubMatchBy] = useState<MacroKey>('proteinG')
  const [subQuery, setSubQuery] = useState('')

  const applySubstitution = (mealId: string, item: EditableItem, substitute: Food) => {
    const targetAbsolute = parseFloat(item[subMatchBy]) || 0
    const grams = gramsForAbsoluteMacro(substitute, targetAbsolute, subMatchBy)
    if (grams == null) {
      toast(`${substitute.name} no aporta nada de ${MACRO_LABELS[subMatchBy]} — prueba a igualar por otro macro`, 'warn')
      return
    }
    const macros = computeMacros(substitute, grams, 'g')
    if (!macros) return
    updateItem(mealId, item.id, {
      foodName: substitute.name, quantity: String(Math.round(grams * 10) / 10), unit: 'g',
      kcal: String(macros.kcal), proteinG: String(macros.proteinG), carbsG: String(macros.carbsG), fatG: String(macros.fatG),
      fiberG: macros.fiberG != null ? String(macros.fiberG) : '', sugarG: macros.sugarG != null ? String(macros.sugarG) : '',
      sodiumMg: macros.sodiumMg != null ? String(macros.sodiumMg) : '', saturatedFatG: macros.saturatedFatG != null ? String(macros.saturatedFatG) : '',
      calciumMg: macros.calciumMg != null ? String(macros.calciumMg) : '', ironMg: macros.ironMg != null ? String(macros.ironMg) : '',
      zincMg: macros.zincMg != null ? String(macros.zincMg) : '',
    })
    toast(`Sustituido por ${substitute.name} (${Math.round(grams * 10) / 10}g) ✓`, 'ok')
    setSubstitutingFor(null); setSubQuery('')
  }

  const addSupplement = () => setSupplements([...supplements, { id: newId(), name: '', dose: '', timing: '', visibleToClient: true }])
  const removeSupplement = (id: string) => setSupplements(supplements.filter(s => s.id !== id))
  const updateSupplement = (id: string, updates: Partial<EditableSupplement>) => setSupplements(supplements.map(s => s.id === id ? { ...s, ...updates } : s))

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  if (!planId) return (
    <div className="bg-card border border-border rounded-2xl p-12 text-center max-w-lg">
      <p className="text-muted text-sm mb-4">{personalMode ? 'Todavía no tienes un plan de dieta activo.' : 'Este cliente no tiene plan de dieta activo.'}</p>
      <Button onClick={handleCreatePlan}>Crear plan de dieta</Button>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <FoodConverterDrawer nutricionistaId={nutricionistaId} demoMode={!!demoPlan} />
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

      {editingRecipe && (
        <RecipeEditorPanel nutricionistaId={nutricionistaId} demoMode={!!demoPlan} foods={foods}
          initial={editingRecipe} onClose={() => setEditingRecipe(null)}
          onSaved={() => { setEditingRecipe(null); loadRecipes() }} />
      )}

      {recipes.length > 0 && (() => {
        const systemRecipes = recipes.filter(r => r.nutricionista_id === null)
        const ownRecipes = recipes.filter(r => r.nutricionista_id !== null)
        return (
          <div className="space-y-3">
            {systemRecipes.length > 0 && (
              <RecipeGroup title="Recetas del sistema" recipes={systemRecipes} onCopy={copyRecipe} />
            )}
            {ownRecipes.length > 0 && (
              <RecipeGroup title="Tus recetas" recipes={ownRecipes} onDelete={deleteRecipe} onSetPhoto={setRecipePhoto}
                onEdit={setEditingRecipe} nutricionistaId={nutricionistaId} demoMode={!!demoPlan} />
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => printRecipeBook(nutricionistaName || 'Tu nutricionista', recipes.map(r => ({
                name: r.name, photoUrl: r.photo_url, steps: r.steps, items: (r.items as EditableItem[] | null) || [],
              })), { logoUrl: nutricionistaLogoUrl, accentColor: nutricionistaAccentColor })} className="flex items-center gap-1.5 text-xs font-bold text-accent">
                <BookOpen className="w-3.5 h-3.5" /> Descargar recetario en PDF
              </button>
              {dynamicRecetario().length > 0 && (
                <button onClick={() => printRecipeBook(nutricionistaName || 'Tu nutricionista', dynamicRecetario(), { logoUrl: nutricionistaLogoUrl, accentColor: nutricionistaAccentColor })}
                  className="flex items-center gap-1.5 text-xs font-bold text-accent" title={personalMode ? 'Solo las recetas usadas en este plan, con las cantidades ya ajustadas a tus necesidades' : 'Solo las recetas usadas en este plan, con las cantidades ya ajustadas a este cliente'}>
                  <BookOpen className="w-3.5 h-3.5" /> Recetario de este plan ({dynamicRecetario().length})
                </button>
              )}
            </div>
          </div>
        )
      })()}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Objetivo de macros</p>
          <button onClick={() => setShowCalculator(v => !v)} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Calculator className="w-3.5 h-3.5" /> Calculadora metabólica
          </button>
        </div>
        {showCalculator && (
          <MetabolicCalculatorPanel client={client} onClose={() => setShowCalculator(false)}
            onApply={(result) => {
              setKcalTarget(String(result.kcalTarget)); setProteinG(String(result.proteinG))
              setCarbsG(String(result.carbsG)); setFatG(String(result.fatG)); setFiberG(String(result.fiberG))
              setShowCalculator(false)
              toast('Objetivo de macros aplicado — recuerda guardar el plan ✓', 'ok')
            }} />
        )}
        <div className="grid grid-cols-5 gap-3">
          <NumInput label="Kcal" value={kcalTarget} onChange={setKcalTarget} />
          <NumInput label="Proteína (g)" value={proteinG} onChange={setProteinG} />
          <NumInput label="Carbos (g)" value={carbsG} onChange={setCarbsG} />
          <NumInput label="Grasas (g)" value={fatG} onChange={setFatG} />
          <NumInput label="Fibra (g)" value={fiberG} onChange={setFiberG} />
        </div>
        {(() => {
          // Solo una comida por hueco: si hay opciones intercambiables,
          // cuenta la primera — son alternativas del mismo hueco, no
          // comidas que se suman todas el mismo día. Si hay carb cycling,
          // solo cuenta el tipo de día elegido en el selector de abajo (si
          // no, ON y OFF se sumarían como si se comieran las dos a la vez).
          const oneOptionPerSlot = Array.from(new Map(macroMeals.map(m => [m.optionGroup || m.id, m])).values())
          const dailyTotals = sumMealsMacros(oneOptionPerSlot)
          if (dailyTotals.kcal === 0) return null
          return (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Suma de {selectedDay === 'all' ? 'las comidas' : `${DAY_LABELS[selectedDay as number]}`} vs. objetivo
                </p>
                {usesCarbCycling && (
                  <div className="flex gap-1">
                    {(['all', 'on', 'off'] as const).map(v => (
                      <button key={v} type="button" onClick={() => setSelectedDayType(v)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                          selectedDayType === v ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
                        }`}>
                        {v === 'all' ? 'Cualquiera' : v === 'on' ? '🔥 ON' : '🌙 OFF'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {usesCarbCycling && selectedDayType === 'all' && (
                <p className="text-[10px] text-muted -mt-1">Solo cuentan las comidas de "cualquier tipo" — elige ON u OFF para ver el total de ese día.</p>
              )}
              <MacroProgressBar label="Kcal" actual={dailyTotals.kcal} target={parseFloat(kcalTarget) || 0} unit="" />
              <MacroProgressBar label="Proteína" actual={dailyTotals.proteinG} target={parseFloat(proteinG) || 0} unit="g" />
              <MacroProgressBar label="Carbohidratos" actual={dailyTotals.carbsG} target={parseFloat(carbsG) || 0} unit="g" />
              <MacroProgressBar label="Grasas" actual={dailyTotals.fatG} target={parseFloat(fatG) || 0} unit="g" />
              <MacroProgressBar label="Fibra" actual={dailyTotals.fiberG} target={parseFloat(fiberG) || 0} unit="g" />
            </div>
          )
        })()}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Consejo del nutricionista</label>
          <textarea value={advice} onChange={e => setAdvice(e.target.value)} rows={2}
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-semibold text-sm">Comidas</p>
          <div className="flex items-center gap-2">
            {selectedDay !== 'all' && (
              <select value={copyFromDay} onChange={e => { setCopyFromDay(e.target.value); if (e.target.value !== '') copyDayMeals() }}
                className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
                <option value="">Copiar comidas de...</option>
                {DAY_LABELS.map((label, i) => i !== selectedDay && meals.some(m => m.dayOfWeek === i) && (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            )}
            <button onClick={addMeal} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir comida</button>
            <button onClick={() => setImportOpen(true)} title="Importar comidas desde un Excel o CSV, en vez de meterlas a mano"
              className="flex items-center gap-1 text-xs font-bold text-muted hover:text-accent"><FileSpreadsheet className="w-3.5 h-3.5" /> Importar</button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          <button onClick={() => setSelectedDay('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedDay === 'all' ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
            }`}>
            Todos los días{meals.filter(m => m.dayOfWeek == null).length > 0 ? ` (${meals.filter(m => m.dayOfWeek == null).length})` : ''}
          </button>
          {DAY_LABELS.map((label, i) => (
            <button key={i} onClick={() => setSelectedDay(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedDay === i ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
              }`}>
              {label}{meals.filter(m => m.dayOfWeek === i).length > 0 ? ` (${meals.filter(m => m.dayOfWeek === i).length})` : ''}
            </button>
          ))}
        </div>
        {selectedDay !== 'all' && usesWeeklyMenu && (
          <p className="text-[11px] text-muted -mt-1.5">
            Se muestran las comidas de {DAY_LABELS[selectedDay as number]}, más las de "Todos los días" si las hay.
          </p>
        )}

        {visibleMeals.length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
            <p className="text-muted text-sm">
              {selectedDay === 'all' ? 'Sin comidas fijas para todos los días.' : `Sin comidas para ${DAY_LABELS[selectedDay as number]}.`}
              {' '}Pulsa "Añadir comida" o copia las de otro día.
            </p>
          </div>
        )}

        {mealGroups.map(group => {
          const isGroup = !!group[0].optionGroup
          return (
            <div key={group[0].optionGroup || group[0].id} className={isGroup ? 'border-2 border-dashed border-accent/30 rounded-2xl p-3 space-y-3' : ''}>
              {isGroup && (
                <div className="flex items-center justify-between px-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-accent uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5" /> Opciones intercambiables
                  </p>
                  <button onClick={() => addOption(group[0])} className="flex items-center gap-1 text-xs font-bold text-accent">
                    <Plus className="w-3.5 h-3.5" /> Añadir opción
                  </button>
                </div>
              )}
              {group.map(meal => (
          <div key={meal.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isGroup && (
                <input value={meal.optionLabel || ''} onChange={e => updateMeal(meal.id, { optionLabel: e.target.value })} placeholder="Opción A"
                  className="w-28 px-2.5 py-2 bg-bg border border-border rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
              )}
              <input value={meal.name} onChange={e => updateMeal(meal.id, { name: e.target.value })} placeholder="Nombre (ej. Desayuno)"
                className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
              <input type="time" value={meal.time} onChange={e => updateMeal(meal.id, { time: e.target.value })}
                className="w-28 px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
              <input type="number" value={meal.kcalTarget} onChange={e => updateMeal(meal.id, { kcalTarget: e.target.value })} placeholder="Kcal"
                className="w-20 px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
              <select value={meal.dayOfWeek ?? ''} onChange={e => updateMeal(meal.id, { dayOfWeek: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                title="Día de la semana"
                className="px-2 py-2 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
                <option value="">Todos los días</option>
                {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
              </select>
              <select value={meal.dayType ?? ''} onChange={e => updateMeal(meal.id, { dayType: e.target.value === '' ? null : e.target.value as 'on' | 'off' })}
                title="Carb cycling: día de entrenamiento (ON) o de descanso (OFF)"
                className="px-2 py-2 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
                <option value="">Cualquier tipo</option>
                <option value="on">🔥 Día ON</option>
                <option value="off">🌙 Día OFF</option>
              </select>
              {isGroup ? (
                <button onClick={() => removeFromOptionGroup(meal.id)} title="Quitar de opciones" className="p-2 text-muted hover:text-warn"><X className="w-4 h-4" /></button>
              ) : (
                <button onClick={() => addOption(meal)} title="Convertir en opciones intercambiables" className="p-2 text-muted hover:text-accent"><Layers className="w-4 h-4" /></button>
              )}
              <button onClick={() => removeMeal(meal.id)} className="p-2 text-muted hover:text-warn"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {meal.items.map(item => {
                const allergenHit = detectAllergenConflict(client.allergies, item.foodName)
                const suggestions = openSuggestFor === item.id && item.foodName.trim().length > 0
                  ? foods.filter(f => f.name.toLowerCase().includes(item.foodName.toLowerCase()) && foodMatchesTags(f, activeFoodTags)).slice(0, 6)
                  : []
                const isExpanded = expandedItem === item.id
                const hasExtra = item.fiberG || item.sugarG || item.sodiumMg || item.saturatedFatG || item.calciumMg || item.ironMg || item.zincMg
                return (
                  <div key={item.id}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[140px]">
                        <input value={item.foodName}
                          onChange={e => updateItem(meal.id, item.id, { foodName: e.target.value })}
                          onFocus={() => setOpenSuggestFor(item.id)}
                          onBlur={() => setTimeout(() => setOpenSuggestFor(null), 150)}
                          placeholder="Alimento"
                          className="w-full px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                        {openSuggestFor === item.id && item.foodName.trim().length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            <FoodTagFilterPills active={activeFoodTags} onToggle={toggleFoodTag} />
                            {suggestions.length === 0 ? (
                              <p className="px-2.5 py-2 text-[11px] text-muted">Sin resultados con estos filtros.</p>
                            ) : suggestions.map(f => (
                              <button key={f.id} type="button" onMouseDown={() => selectFood(meal.id, item.id, f)}
                                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className="truncate">{f.name}</span>
                                  <FoodTagBadges food={f} />
                                </span>
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
                      <button onClick={() => setScanningFor({ mealId: meal.id, itemId: item.id })} title="Escanear código de barras"
                        className="p-1.5 text-muted hover:text-accent flex-shrink-0"><Barcode className="w-3.5 h-3.5" /></button>
                      <button onClick={() => {
                        const isOpen = substitutingFor?.itemId === item.id
                        setSubstitutingFor(isOpen ? null : { mealId: meal.id, itemId: item.id })
                        setSubQuery('')
                      }} title="Sustituir por un alimento equivalente"
                        className="p-1.5 text-muted hover:text-accent flex-shrink-0"><Repeat className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        title="Nutrientes ampliados (fibra, azúcares, sodio, grasas saturadas)"
                        className={`p-1.5 flex-shrink-0 ${hasExtra ? 'text-accent' : 'text-muted hover:text-accent'}`}>
                        <FlaskConical className="w-3.5 h-3.5" />
                      </button>
                      {allergenHit && (
                        <span title={`${personalMode ? 'Posible alérgeno para ti' : 'Posible alérgeno para este cliente'}: ${allergenHit.replace('_', ' ')}`} className="flex-shrink-0 text-warn">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <button onClick={() => removeItem(meal.id, item.id)} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {isExpanded && (
                      <div className="flex items-center gap-2 mt-1.5 pl-1 flex-wrap">
                        <button onClick={() => setExpandedItem(null)} className="text-muted"><ChevronUp className="w-3 h-3" /></button>
                        <MicroInput label="Fibra (g)" value={item.fiberG} onChange={v => updateItem(meal.id, item.id, { fiberG: v })} />
                        <MicroInput label="Azúcares (g)" value={item.sugarG} onChange={v => updateItem(meal.id, item.id, { sugarG: v })} />
                        <MicroInput label="Sodio (mg)" value={item.sodiumMg} onChange={v => updateItem(meal.id, item.id, { sodiumMg: v })} />
                        <MicroInput label="Sat. (g)" value={item.saturatedFatG} onChange={v => updateItem(meal.id, item.id, { saturatedFatG: v })} />
                        <MicroInput label="Calcio (mg)" value={item.calciumMg} onChange={v => updateItem(meal.id, item.id, { calciumMg: v })} />
                        <MicroInput label="Hierro (mg)" value={item.ironMg} onChange={v => updateItem(meal.id, item.id, { ironMg: v })} />
                        <MicroInput label="Zinc (mg)" value={item.zincMg} onChange={v => updateItem(meal.id, item.id, { zincMg: v })} />
                      </div>
                    )}
                    {!isExpanded && hasExtra && (
                      <button onClick={() => setExpandedItem(item.id)} className="flex items-center gap-1 text-[10px] text-muted hover:text-accent mt-0.5 pl-1">
                        <ChevronDown className="w-3 h-3" /> fibra {item.fiberG || 0}g · azúc. {item.sugarG || 0}g · sodio {item.sodiumMg || 0}mg · sat. {item.saturatedFatG || 0}g
                        {(item.calciumMg || item.ironMg || item.zincMg) ? ` · Ca ${item.calciumMg || 0}mg · Fe ${item.ironMg || 0}mg · Zn ${item.zincMg || 0}mg` : ''}
                      </button>
                    )}
                    {substitutingFor?.itemId === item.id && (
                      <div className="mt-1.5 pl-1 pr-1 pt-2 border-t border-border space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Igualar por</span>
                          {(['proteinG', 'kcal', 'carbsG', 'fatG'] as MacroKey[]).map(k => (
                            <button key={k} onClick={() => setSubMatchBy(k)}
                              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                subMatchBy === k ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
                              }`}>
                              {MACRO_LABELS[k]}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <input value={subQuery} onChange={e => setSubQuery(e.target.value)}
                            placeholder={`Busca un sustituto para "${item.foodName}"...`} autoFocus
                            className="w-full px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            <FoodTagFilterPills active={activeFoodTags} onToggle={toggleFoodTag} />
                            {subQuery.trim().length === 0 ? (
                              <>
                                <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Sugeridos por macros parecidos</p>
                                {rankSubstitutesByMacros(
                                  { kcal: parseFloat(item.kcal) || 0, proteinG: parseFloat(item.proteinG) || 0, carbsG: parseFloat(item.carbsG) || 0, fatG: parseFloat(item.fatG) || 0 },
                                  item.foodName, foods.filter(f => foodMatchesTags(f, activeFoodTags)), subMatchBy,
                                ).slice(0, 6).map(({ food: f, grams }) => (
                                  <button key={f.id} type="button" onMouseDown={() => applySubstitution(meal.id, item, f)}
                                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 min-w-0">
                                      <span className="truncate">{f.name}</span>
                                      <FoodTagBadges food={f} />
                                    </span>
                                    <span className="text-muted flex-shrink-0">≈ {Math.round(grams * 10) / 10}g</span>
                                  </button>
                                ))}
                              </>
                            ) : (
                              foods.filter(f => f.name.toLowerCase().includes(subQuery.toLowerCase()) && f.name !== item.foodName && foodMatchesTags(f, activeFoodTags)).slice(0, 6).map(f => {
                                const grams = gramsForAbsoluteMacro(f, parseFloat(item[subMatchBy]) || 0, subMatchBy)
                                return (
                                  <button key={f.id} type="button" onMouseDown={() => applySubstitution(meal.id, item, f)}
                                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 min-w-0">
                                      <span className="truncate">{f.name}</span>
                                      <FoodTagBadges food={f} />
                                    </span>
                                    <span className="text-muted flex-shrink-0">{grams != null ? `≈ ${Math.round(grams * 10) / 10}g` : 'sin ese macro'}</span>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={() => addItem(meal.id)} className="flex items-center gap-1 text-xs text-muted hover:text-accent"><Plus className="w-3 h-3" /> Añadir alimento</button>
            </div>

            {meal.items.length > 0 && (() => {
              const totals = sumItemMacros(meal.items)
              return (
                <div className="flex items-center gap-3 text-xs bg-bg-alt rounded-xl px-3 py-2">
                  <span className="font-semibold uppercase tracking-wider text-muted text-[10px]">Total comida</span>
                  <span><strong>{Math.round(totals.kcal)}</strong> kcal</span>
                  <span><strong>{Math.round(totals.proteinG * 10) / 10}</strong>g prot.</span>
                  <span><strong>{Math.round(totals.carbsG * 10) / 10}</strong>g carbos</span>
                  <span><strong>{Math.round(totals.fatG * 10) / 10}</strong>g grasas</span>
                  <span><strong>{Math.round(totals.fiberG * 10) / 10}</strong>g fibra</span>
                </div>
              )
            })()}

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
          )
        })}
      </div>

      <ShoppingListPreview meals={meals} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Suplementación</p>
          <button onClick={addSupplement} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir</button>
        </div>
        {supplements.map(sup => (
          <div key={sup.id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-2 flex-wrap">
            <input value={sup.name} onChange={e => updateSupplement(sup.id, { name: e.target.value })} placeholder="Nombre"
              className="flex-1 min-w-[120px] px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={sup.dose} onChange={e => updateSupplement(sup.id, { dose: e.target.value })} placeholder="Dosis"
              className="w-24 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={sup.timing} onChange={e => updateSupplement(sup.id, { timing: e.target.value })} placeholder="Cuándo"
              className="w-24 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            <button onClick={() => updateSupplement(sup.id, { visibleToClient: !sup.visibleToClient })}
              className="p-1.5 text-muted hover:text-ink" title={personalMode
                ? (sup.visibleToClient ? 'Visible en tu seguimiento diario' : 'Oculto en tu seguimiento diario')
                : (sup.visibleToClient ? 'Visible para el cliente' : 'Oculto para el cliente')}>
              {sup.visibleToClient ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => removeSupplement(sup.id)} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSave} loading={saving}>Guardar plan</Button>
        <Button variant="outline" onClick={handlePrint}><Download className="w-3.5 h-3.5" /> Descargar PDF</Button>
        <Button variant="outline" onClick={() => {
          const url = `${window.location.origin}/?c=${client.token}`
          const message = `Hola ${client.name} 👋\n\nAquí tienes tu plan de dieta actualizado, ábrelo directamente desde este enlace:\n${url}`
          window.open(buildWAUrl(client.phone, message), '_blank')
        }}>
          <Send className="w-3.5 h-3.5" /> Enviar por WhatsApp
        </Button>
        <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nombre de la plantilla"
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20 w-48" />
        <Button variant="outline" onClick={handleSaveTemplate}><BookmarkPlus className="w-3.5 h-3.5" /> Guardar como plantilla</Button>
      </div>

      <BarcodeScanner open={!!scanningFor} onClose={() => setScanningFor(null)} onFound={handleScanned} />
      <ImportDietPlanModal open={importOpen} onClose={() => setImportOpen(false)} foods={foods}
        onImport={imported => setMeals(prev => [...prev, ...imported])} />
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

/** Barra de progreso "objetivo vs. lo sumado en las comidas" para un macro —
 * se llena hasta el 100% del objetivo; si se pasa, la barra se corta en
 * 100% pero cambia a rojo y el número muestra el exceso real. Sin objetivo
 * fijado (0 o vacío) no hay nada que comparar, así que no se pinta barra. */
function MacroProgressBar({ label, actual, target, unit }: { label: string; actual: number; target: number; unit: string }) {
  if (!target) return null
  const pct = (actual / target) * 100
  const over = pct > 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-muted">{label}</span>
        <span className={over ? 'text-warn font-semibold' : 'text-muted'}>
          {Math.round(actual * 10) / 10}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-1.5 bg-bg-alt rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${over ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  )
}

function RecipeGroup({ title, recipes, onDelete, onCopy, onSetPhoto, onEdit, nutricionistaId, demoMode }: {
  title: string; recipes: RecipeRow[]; onDelete?: (id: string) => void; onCopy?: (recipe: RecipeRow) => void
  onSetPhoto?: (recipe: RecipeRow, url: string) => void
  onEdit?: (recipe: RecipeRow) => void
  nutricionistaId?: string; demoMode?: boolean
}) {
  const [stepsOpenFor, setStepsOpenFor] = useState<string | null>(null)
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
        <ChefHat className="w-3.5 h-3.5" /> {title} ({recipes.length})
      </p>
      <div className="space-y-1.5">
        {recipes.map(r => {
          const totals = sumItemMacros((r.items as EditableItem[] | null) || [])
          return (
            <div key={r.id} onClick={onEdit ? () => onEdit(r) : undefined}
              className={`bg-bg-alt rounded-xl px-3 py-2 ${onEdit ? 'cursor-pointer hover:bg-accent/5 transition-colors' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {onSetPhoto && nutricionistaId ? (
                    <div onClick={e => e.stopPropagation()}>
                      <RecipePhotoUpload nutricionistaId={nutricionistaId} currentUrl={r.photo_url} demoMode={demoMode}
                        onUploaded={url => onSetPhoto(r, url)} />
                    </div>
                  ) : r.photo_url ? (
                    <img src={r.photo_url} alt={r.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{r.name}</p>
                    <p className="text-[11px] text-muted">
                      {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG * 10) / 10}g prot. · {Math.round(totals.carbsG * 10) / 10}g carbos · {Math.round(totals.fatG * 10) / 10}g grasas · {Math.round(totals.fiberG * 10) / 10}g fibra
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {r.steps && (
                    <button onClick={e => { e.stopPropagation(); setStepsOpenFor(stepsOpenFor === r.id ? null : r.id) }}
                      className="p-1 text-muted hover:text-accent" title="Ver pasos de preparación">
                      {stepsOpenFor === r.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {onCopy && (
                    <button onClick={e => { e.stopPropagation(); onCopy(r) }} className="p-1 text-muted hover:text-accent" title="Copiar a mis recetas"><Copy className="w-3.5 h-3.5" /></button>
                  )}
                  {onDelete && (
                    <button onClick={e => { e.stopPropagation(); onDelete(r.id) }} className="p-1 text-muted hover:text-warn" title="Eliminar receta"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
              {stepsOpenFor === r.id && r.steps && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Preparación</p>
                  <p className="text-[11px] whitespace-pre-line">{r.steps}</p>
                </div>
              )}
              {onEdit && (
                <p className="text-[10px] text-accent mt-1.5">Toca para ver/editar la receta completa</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetabolicCalculatorPanel({ client, onClose, onApply }: {
  client: ClientData
  onClose: () => void
  onApply: (result: { kcalTarget: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }) => void
}) {
  const inferredSex: Sex = client.gender?.toLowerCase().includes('mujer') ? 'mujer' : 'hombre'
  const inferredAge = ageFromBirthDate(client.birthDate)
  const [formula, setFormula] = useState<Formula>('mifflin')
  const [sex, setSex] = useState<Sex>(inferredSex)
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState(client.heightCm ? String(client.heightCm) : '')
  const [age, setAge] = useState(inferredAge != null ? String(inferredAge) : '')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderado')
  const [goal, setGoal] = useState<Goal>('deficit')
  const [proteinGPerKg, setProteinGPerKg] = useState('2')
  const [fatGPerKg, setFatGPerKg] = useState('1')

  const result = computeMetabolicPlan({
    formula, sex, weightKg: parseFloat(weightKg), heightCm: parseFloat(heightCm), age: parseFloat(age),
    bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : undefined,
    activity, goal, proteinGPerKg: parseFloat(proteinGPerKg) || 0, fatGPerKg: parseFloat(fatGPerKg) || 0,
  })

  return (
    <div className="bg-bg-alt rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Calculadora metabólica</p>
        <button onClick={onClose} className="p-1 text-muted hover:text-warn"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Fórmula</label>
          <select value={formula} onChange={e => setFormula(e.target.value as Formula)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            <option value="mifflin">Mifflin-St Jeor</option>
            <option value="harris">Harris-Benedict</option>
            <option value="katch">Katch-McArdle (% grasa)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Sexo</label>
          <select value={sex} onChange={e => setSex(e.target.value as Sex)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
          </select>
        </div>
        <CalcNumInput label="Peso actual (kg)" value={weightKg} onChange={setWeightKg} />
        <CalcNumInput label="Altura (cm)" value={heightCm} onChange={setHeightCm} />
        <CalcNumInput label="Edad" value={age} onChange={setAge} />
        {formula === 'katch' && <CalcNumInput label="% grasa corporal" value={bodyFatPct} onChange={setBodyFatPct} />}
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Actividad</label>
          <select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(k => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Objetivo</label>
          <select value={goal} onChange={e => setGoal(e.target.value as Goal)}
            className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
            {(Object.keys(GOAL_LABELS) as Goal[]).map(k => <option key={k} value={k}>{GOAL_LABELS[k]}</option>)}
          </select>
        </div>
        <CalcNumInput label="Proteína (g/kg)" value={proteinGPerKg} onChange={setProteinGPerKg} />
        <CalcNumInput label="Grasas (g/kg)" value={fatGPerKg} onChange={setFatGPerKg} />
      </div>

      {result ? (
        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-muted">TMB <strong className="text-ink">{result.bmr}</strong> kcal</span>
            <span className="text-muted">Gasto total <strong className="text-ink">{result.tdee}</strong> kcal</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <MacroPreview label="Kcal" value={result.kcalTarget} />
            <MacroPreview label="Prot." value={`${result.proteinG}g`} />
            <MacroPreview label="Carbos" value={`${result.carbsG}g`} />
            <MacroPreview label="Grasas" value={`${result.fatG}g`} />
            <MacroPreview label="Fibra" value={`${result.fiberG}g`} />
          </div>
          <Button size="sm" onClick={() => onApply(result)}>Aplicar al plan</Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted pt-1">
          Rellena peso, altura y edad {formula === 'katch' ? '(y % de grasa corporal) ' : ''}para calcular.
        </p>
      )}
    </div>
  )
}

function CalcNumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}

function MacroPreview({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg rounded-lg py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xs font-bold mt-0.5">{value}</p>
    </div>
  )
}

/** Vista previa de la lista de la compra que le va a generar el plan al
 * cliente (misma lógica que DietaClienteTab), para que el nutricionista
 * pueda verla/revisarla sin tener que mirar el panel del cliente. */
function ShoppingListPreview({ meals }: { meals: EditableMeal[] }) {
  const [open, setOpen] = useState(false)
  const items = buildShoppingList(meals)
  if (items.length === 0) return null
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5" /> Lista de la compra ({items.length})
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted mb-2">Así es como la verá tu cliente en su panel.</p>
          <ul className="space-y-1">
            {items.map(item => {
              const qtyLabel = item.totalQty !== null ? `${item.totalQty}${item.unit ? ` ${item.unit}` : ''}` : item.parts.join(' + ')
              const fiberRounded = Math.round(item.fiberG * 10) / 10
              return (
                <li key={item.key} className="flex items-center gap-2 text-sm py-0.5">
                  <Check className="w-3 h-3 text-muted flex-shrink-0" />
                  <span className="flex-1">{item.foodName}</span>
                  {fiberRounded > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${fiberRounded >= 5 ? 'bg-ok/10 text-ok font-semibold' : 'bg-bg-alt text-muted'}`}>
                      {fiberRounded}g fibra
                    </span>
                  )}
                  <span className="text-xs text-muted">{qtyLabel}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

const FOOD_TAG_ORDER: DietaryTag[] = ['sin_gluten', 'sin_lactosa', 'bajo_fodmap', 'vegano', 'alto_proteina', 'bajo_sodio', 'alto_omega3']
const FOOD_TAG_SHORT: Record<DietaryTag, string> = {
  sin_gluten: 'SG', sin_lactosa: 'SL', bajo_fodmap: 'FODMAP-', vegano: 'V', alto_proteina: 'P+',
  bajo_sodio: 'Na-', alto_omega3: 'Ω3',
}

/** Pills de filtro rápido dietoterapéutico sobre el buscador de alimentos —
 * en modo AND: activar varias exige que el alimento cumpla todas a la vez. */
function FoodTagFilterPills({ active, onToggle }: { active: DietaryTag[]; onToggle: (tag: DietaryTag) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 border-b border-border sticky top-0 bg-card">
      {FOOD_TAG_ORDER.map(tag => (
        <button key={tag} type="button" onMouseDown={e => e.preventDefault()} onClick={() => onToggle(tag)}
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
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
function FoodTagBadges({ food }: { food: Food }) {
  const tags = classifyFoodTags(food)
  const relevant = FOOD_TAG_ORDER.filter(t => tags.includes(t))
  if (relevant.length === 0) return null
  return (
    <span className="flex items-center gap-0.5 flex-shrink-0">
      {relevant.map(t => (
        <span key={t} title={DIETARY_TAG_LABELS[t]} className="px-1 py-0.5 bg-ok/10 text-ok rounded text-[9px] font-bold">
          {FOOD_TAG_SHORT[t]}
        </span>
      ))}
    </span>
  )
}

function MicroInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-[10px] text-muted whitespace-nowrap">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-14 px-1.5 py-1 bg-bg border border-border rounded-md text-[11px] outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}
