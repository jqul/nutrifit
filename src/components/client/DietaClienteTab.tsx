import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DietMealRow, DietMealItemRow, DietSupplementRow, RecipeRow } from '../../lib/supabase-types'
import { dietPlanFromRows, foodFromRow } from '../../lib/mappers'
import { DietPlan, DietMeal, ClientData, Food, DietMealItem } from '../../types'
import { printDietPlan } from '../../lib/printPlan'
import { buildShoppingList, groupShoppingItemsByAisle } from '../../lib/shoppingList'
import { gramsForAbsoluteMacro, MacroKey } from '../../lib/foodConversion'
import { todayDayOfWeek } from '../../lib/date'
import { groupMealsByOption, loadOptionChoices, saveOptionChoice, loadDayType, saveDayType } from '../../lib/planMeals'
import { buildWAUrl } from '../../lib/whatsapp'
import { BottomSheet } from '../shared/BottomSheet'
import { BarcodeScanner } from '../shared/BarcodeScanner'
import { ScannedFood } from '../../lib/openFoodFacts'
import {
  Utensils, ShoppingCart, Check, Download, Repeat, CalendarDays, ChevronDown, ChevronUp, Layers, Flame, Moon,
  Barcode, MessageCircle, ChefHat, BookOpen,
} from 'lucide-react'

const MACRO_LABELS: Record<MacroKey, string> = { kcal: 'kcal', proteinG: 'proteína', carbsG: 'carbohidratos', fatG: 'grasas' }
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Para la lista de la compra: de cada grupo de opciones se queda solo con
 * la que el cliente ha elegido (o la primera si aún no ha elegido) — no
 * tiene sentido comprar ingredientes de alternativas que no va a cocinar.
 * Las comidas sin optionGroup se mantienen todas, sin cambios. */
function resolveChosenMeals(meals: DietMeal[], choices: Record<string, string>): DietMeal[] {
  return groupMealsByOption(meals).map(g => {
    if (g.length === 1) return g[0]
    const groupId = g[0].optionGroup as string
    return g.find(m => m.id === choices[groupId]) || g[0]
  })
}

export function DietaClienteTab({ client, demoMode, demoPlan, demoRecipes }: {
  client: ClientData; demoMode?: boolean; demoPlan?: DietPlan; demoRecipes?: RecipeRow[]
}) {
  const clientId = client.id
  const [plan, setPlan] = useState<DietPlan | null>(demoPlan ?? null)
  const [loading, setLoading] = useState(!demoPlan)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [foods, setFoods] = useState<Food[]>([])
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek())
  const [showWeekSummary, setShowWeekSummary] = useState(false)
  // Pauta flexible por opciones: qué opción eligió el cliente para cada
  // optionGroup. Es puramente informativo del lado del cliente — se guarda
  // en localStorage (no en la BD) para que sobreviva a recargar la página,
  // igual de "local" que el sistema de intercambios de alimentos.
  const [optionChoices, setOptionChoices] = useState<Record<string, string>>({})
  // Carb cycling: qué tipo de día es hoy para el cliente — día de
  // entrenamiento (ON) o de descanso (OFF). Igual de local/informativo que
  // optionChoices: se guarda en localStorage, no en la BD.
  const [dayType, setDayType] = useState<'on' | 'off'>('on')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedFood, setScannedFood] = useState<ScannedFood | null>(null)
  const [viewingRecipe, setViewingRecipe] = useState<RecipeRow | null>(null)

  const toggleChecked = (key: string) => setChecked(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  useEffect(() => {
    setOptionChoices(plan ? loadOptionChoices(plan.id) : {})
  }, [plan?.id])

  const chooseOption = (groupId: string, mealId: string) => {
    if (!plan) return
    setOptionChoices(saveOptionChoice(plan.id, groupId, mealId))
  }

  useEffect(() => {
    if (plan) setDayType(loadDayType(plan.id))
  }, [plan?.id])

  const chooseDayType = (v: 'on' | 'off') => {
    setDayType(v)
    if (plan) saveDayType(plan.id, v)
  }

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

  // Recetas (foto + pasos de preparación) de los platos del plan — solo
  // las realmente usadas (identificadas por recipeId en los ítems), igual
  // que el recetario dinámico del lado del nutricionista.
  useEffect(() => {
    if (!plan) { setRecipes([]); return }
    const recipeIds = Array.from(new Set(plan.meals.flatMap(m => m.items).map(i => i.recipeId).filter((id): id is string => !!id)))
    if (recipeIds.length === 0) { setRecipes([]); return }
    if (demoMode) { setRecipes((demoRecipes || []).filter(r => recipeIds.includes(r.id))); return }
    supabase.from('recipes').select('*').in('id', recipeIds).then(({ data }) => setRecipes(data || []))
  }, [plan, demoMode, demoRecipes])

  useEffect(() => {
    if (demoPlan) return
    ;(async () => {
      setLoading(true)
      const { data: planRow } = await supabase.from('diet_plans').select('*').eq('client_id', clientId).eq('is_active', true).maybeSingle()
      if (!planRow) { setPlan(null); setLoading(false); return }
      const [{ data: mealRows }, { data: supRows }] = await Promise.all([
        supabase.from('diet_meals').select('*').eq('plan_id', planRow.id).order('sort_order'),
        supabase.from('diet_supplements').select('*').eq('plan_id', planRow.id),
      ])
      let itemRows: DietMealItemRow[] = []
      if (mealRows?.length) {
        const { data } = await supabase.from('diet_meal_items').select('*').in('meal_id', mealRows.map((m: DietMealRow) => m.id)).order('sort_order')
        itemRows = data || []
      }
      setPlan(dietPlanFromRows(planRow, mealRows || [], itemRows, (supRows || []) as DietSupplementRow[]))
      setLoading(false)
    })()
  }, [clientId, demoPlan])

  if (loading) return null

  if (!plan) return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-muted">
      <Utensils className="w-12 h-12 mx-auto mb-4 opacity-20" />
      <p className="font-serif text-xl font-bold mb-2">Sin plan de dieta</p>
      <p className="text-sm">Tu nutricionista aún no ha creado tu plan. ¡Pronto lo tendrás!</p>
    </div>
  )

  const visibleSupplements = plan.supplements.filter(s => s.visibleToClient)
  const usesWeeklyMenu = plan.meals.some(m => m.dayOfWeek != null)
  const usesCarbCycling = plan.meals.some(m => m.dayType != null)
  const matchesDayType = (m: DietMeal) => m.dayType == null || m.dayType === dayType
  const visibleMeals = (!usesWeeklyMenu ? plan.meals : plan.meals.filter(m => m.dayOfWeek === selectedDay || m.dayOfWeek == null))
    .filter(matchesDayType)

  return (
    <div className="px-4 py-6 space-y-5 max-w-xl mx-auto pb-24">
      <div className="flex justify-between items-center gap-2">
        <button onClick={() => setScannerOpen(true)} className="flex items-center gap-1.5 text-xs font-bold text-accent">
          <Barcode className="w-3.5 h-3.5" /> Escanear producto
        </button>
        <button onClick={() => printDietPlan(client, plan)}
          className="flex items-center gap-1.5 text-xs font-bold text-accent">
          <Download className="w-3.5 h-3.5" /> Descargar PDF
        </button>
      </div>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onFound={food => { setScannerOpen(false); setScannedFood(food) }} />
      {scannedFood && (
        <BottomSheet open onClose={() => setScannedFood(null)} title={scannedFood.name}>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <MacroCard label="Kcal" value={Math.round(scannedFood.kcal)} />
            <MacroCard label="Prot." value={Math.round(scannedFood.proteinG * 10) / 10} suffix="g" />
            <MacroCard label="Carbos" value={Math.round(scannedFood.carbsG * 10) / 10} suffix="g" />
            <MacroCard label="Grasas" value={Math.round(scannedFood.fatG * 10) / 10} suffix="g" />
          </div>
          <p className="text-xs text-muted">Valores por 100g, según Open Food Facts. Comprueba en el envase si encaja en tus macros de hoy.</p>
        </BottomSheet>
      )}
      <div className="grid grid-cols-5 gap-2">
        <MacroCard label="Kcal" value={plan.kcalTarget} />
        <MacroCard label="Prot." value={plan.proteinG} suffix="g" />
        <MacroCard label="Carbos" value={plan.carbsG} suffix="g" />
        <MacroCard label="Grasas" value={plan.fatG} suffix="g" />
        <MacroCard label="Fibra" value={plan.fiberG} suffix="g" />
      </div>

      {plan.advice && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1.5">Consejo de tu nutricionista</p>
          <p className="text-sm leading-relaxed">{plan.advice}</p>
        </div>
      )}

      {usesCarbCycling && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">¿Hoy es día de entrenamiento?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => chooseDayType('on')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                dayType === 'on' ? 'bg-accent text-white' : 'bg-bg-alt text-muted hover:text-ink'
              }`}>
              <Flame className="w-4 h-4" /> Sí, entreno
            </button>
            <button onClick={() => chooseDayType('off')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                dayType === 'off' ? 'bg-accent text-white' : 'bg-bg-alt text-muted hover:text-ink'
              }`}>
              <Moon className="w-4 h-4" /> No, descanso
            </button>
          </div>
        </div>
      )}

      {usesWeeklyMenu && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <button onClick={() => setShowWeekSummary(v => !v)} className="w-full flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Cuadrante semanal</span>
            {showWeekSummary ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
          </button>
          {showWeekSummary && (
            <div className="mt-3 pt-3 border-t border-border space-y-2.5">
              {DAY_LABELS.map((label, day) => {
                const dayMeals = plan.meals.filter(m => (m.dayOfWeek === day || m.dayOfWeek == null) && matchesDayType(m))
                const dayGroups = groupMealsByOption(dayMeals)
                return (
                  <button key={day} onClick={() => { setSelectedDay(day); setShowWeekSummary(false) }}
                    className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${day === selectedDay ? 'bg-accent/10 border border-accent/30' : 'bg-bg-alt hover:bg-bg-alt/70'}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">{label}{day === todayDayOfWeek() ? ' · Hoy' : ''}</p>
                    {dayGroups.length === 0 ? (
                      <p className="text-xs text-muted">Sin comidas</p>
                    ) : (
                      <div className="space-y-0.5">
                        {dayGroups.map(g => (
                          <p key={g[0].optionGroup || g[0].id} className="text-xs flex justify-between gap-2">
                            <span className="truncate">
                              {g.length > 1
                                ? `${g.length} opciones: ${g.map(m => m.name).filter(Boolean).join(' · ')}`
                                : `${g[0].name}${g[0].items.length > 0 ? `: ${g[0].items.map(i => i.foodName).filter(Boolean).join(', ')}` : ''}`}
                            </span>
                            {g.length === 1 && g[0].kcalTarget != null && <span className="text-muted flex-shrink-0">{g[0].kcalTarget} kcal</span>}
                          </p>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {usesWeeklyMenu && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {DAY_LABELS.map((label, day) => (
            <button key={day} onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedDay === day ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
              }`}>
              {label}{day === todayDayOfWeek() ? ' · Hoy' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {visibleMeals.length === 0 && (
          <p className="text-sm text-muted text-center py-4">Sin comidas para {DAY_LABELS[selectedDay]}.</p>
        )}
        {groupMealsByOption(visibleMeals).map(group => {
          const groupId = group[0].optionGroup
          const isGroup = group.length > 1 && !!groupId
          const chosenId = isGroup && groupId && optionChoices[groupId] && group.some(m => m.id === optionChoices[groupId])
            ? optionChoices[groupId] : group[0].id
          const meal = group.find(m => m.id === chosenId) || group[0]
          return (
            <div key={groupId || meal.id} className="bg-card border border-border rounded-2xl p-4">
              {isGroup && groupId && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <Layers className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <div className="flex gap-1 flex-wrap">
                    {group.map((m, i) => (
                      <button key={m.id} onClick={() => chooseOption(groupId, m.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          m.id === chosenId ? 'bg-accent text-white' : 'bg-bg-alt text-muted hover:text-ink'
                        }`}>
                        {m.optionLabel || `Opción ${String.fromCharCode(65 + i)}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{meal.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {meal.time && <span>{meal.time}</span>}
                  {meal.kcalTarget != null && <span>{meal.kcalTarget} kcal</span>}
                </div>
              </div>
              {(() => {
                const mealRecipeIds = Array.from(new Set(meal.items.map(i => i.recipeId).filter((id): id is string => !!id)))
                const mealRecipes = mealRecipeIds.map(id => recipes.find(r => r.id === id)).filter((r): r is RecipeRow => !!r)
                if (mealRecipes.length === 0) return null
                return (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {mealRecipes.map(r => (
                      <button key={r.id} onClick={() => setViewingRecipe(r)}
                        className="flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent rounded-lg text-xs font-semibold">
                        <BookOpen className="w-3 h-3" /> Ver receta{mealRecipes.length > 1 ? `: ${r.name}` : ''}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {meal.items.length > 0 && <MealMacroPills items={meal.items} />}
              {meal.items.length > 0 && (
                <ul className="space-y-1 mt-2">
                  {meal.items.map(item => (
                    <MealItemRow key={item.id} item={item} foods={foods} demoMode={demoMode} />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {visibleSupplements.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Suplementación</p>
          <ul className="space-y-1.5">
            {visibleSupplements.map(s => (
              <li key={s.id} className="text-sm flex justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted">{s.dose} · {s.timing}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ShoppingList meals={resolveChosenMeals(plan.meals.filter(matchesDayType), optionChoices)} foods={foods} checked={checked} onToggle={toggleChecked} />

      {viewingRecipe && (
        <BottomSheet open onClose={() => setViewingRecipe(null)} title={viewingRecipe.name}>
          <div className="space-y-3">
            {viewingRecipe.photo_url && (
              <img src={viewingRecipe.photo_url} alt={viewingRecipe.name} className="w-full aspect-video object-cover rounded-xl" />
            )}
            {viewingRecipe.steps ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5" /> Preparación
                </p>
                <p className="text-sm whitespace-pre-line leading-relaxed">{viewingRecipe.steps}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Tu nutricionista todavía no ha añadido los pasos de preparación de esta receta.</p>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

/** Fila de un ingrediente, con un botón opcional para ver alimentos
 * equivalentes ("sistema de intercambios") — puramente informativo: no
 * modifica el plan real, solo muestra por cuánto se podría cambiar
 * manteniendo el mismo macro. El cambio real solo lo hace el nutricionista. */
function MealItemRow({ item, foods, demoMode }: { item: DietMealItem; foods: Food[]; demoMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const canSubstitute = foods.length > 0

  return (
    <li>
      <div className="text-sm text-muted flex justify-between items-center gap-2">
        <span className="flex-1">{item.foodName}</span>
        <span>{item.quantity} {item.unit}</span>
        {canSubstitute && (
          <button onClick={() => setOpen(true)} title="¿Qué puedo comer en vez de esto?"
            className="p-1 flex-shrink-0 text-muted hover:text-accent">
            <Repeat className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {canSubstitute && <SubstituteSheet open={open} onClose={() => setOpen(false)} item={item} foods={foods} demoMode={demoMode} />}
    </li>
  )
}

/** "¿Qué puedo comer en vez de esto?" — hoja inferior con alternativas ya
 * calculadas en gramos reales para el macro elegido, sin tener que escribir
 * nada primero; el buscador solo sirve para acotar la lista si hace falta. */
function SubstituteSheet({ open, onClose, item, foods, demoMode }: { open: boolean; onClose: () => void; item: DietMealItem; foods: Food[]; demoMode?: boolean }) {
  const [matchBy, setMatchBy] = useState<MacroKey>('proteinG')
  const [query, setQuery] = useState('')

  const itemMacro: Record<MacroKey, number | null> = {
    kcal: item.kcal, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG,
  }
  const candidates = foods.filter(f =>
    f.name !== item.foodName && (query.trim() === '' || f.name.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 8)

  return (
    <BottomSheet open={open} onClose={onClose} title={`En vez de ${item.foodName}...`}>
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Igualar por</span>
          {(['proteinG', 'kcal', 'carbsG', 'fatG'] as MacroKey[]).map(k => (
            <button key={k} onClick={() => setMatchBy(k)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                matchBy === k ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
              }`}>
              {MACRO_LABELS[k]}
            </button>
          ))}
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar otro alimento..."
          className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20" />
        <div className="space-y-1.5">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Sin resultados.</p>
          ) : candidates.map(f => {
            const target = itemMacro[matchBy]
            const grams = target != null ? gramsForAbsoluteMacro(f, target, matchBy) : null
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-bg-alt rounded-xl">
                <span className="text-sm font-medium">{f.name}</span>
                <span className="text-sm font-bold text-accent flex-shrink-0">{grams != null ? `≈ ${Math.round(grams * 10) / 10}g` : 'sin ese macro'}</span>
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-muted pt-1">
          Solo orientativo — coméntaselo a tu nutricionista antes de cambiarlo{demoMode ? ' (modo demo)' : ''}.
        </p>
      </div>
    </BottomSheet>
  )
}

function ShoppingList({ meals, foods, checked, onToggle }: { meals: DietMeal[]; foods: Food[]; checked: Set<string>; onToggle: (key: string) => void }) {
  const items = buildShoppingList(meals)
  if (items.length === 0) return null
  const aisles = groupShoppingItemsByAisle(items, foods)

  const shareText = () => {
    const lines = aisles.flatMap(a => [
      `${a.icon} ${a.label}`,
      ...a.items.map(i => `- ${i.foodName}${i.totalQty !== null ? ` (${i.totalQty}${i.unit ? ' ' + i.unit : ''})` : ''}`),
    ])
    return ['🛒 Lista de la compra', '', ...lines].join('\n')
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5" /> Lista de la compra
        </p>
        <a href={buildWAUrl('', shareText())} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-xs font-bold text-ok flex-shrink-0">
          <MessageCircle className="w-3.5 h-3.5" /> Compartir
        </a>
      </div>
      <p className="text-xs text-muted mb-3">Generada a partir de tu plan de dieta actual. Márcalos según los vayas comprando.</p>
      <div className="space-y-4">
        {aisles.map(aisle => (
          <div key={aisle.label}>
            <p className="text-xs font-semibold text-muted mb-1.5">{aisle.icon} {aisle.label}</p>
            <ul className="space-y-1.5">
              {aisle.items.map(item => {
                const isChecked = checked.has(item.key)
                const qtyLabel = item.totalQty !== null ? `${item.totalQty}${item.unit ? ` ${item.unit}` : ''}` : item.parts.join(' + ')
                const fiberRounded = Math.round(item.fiberG * 10) / 10
                return (
                  <li key={item.key}>
                    <button onClick={() => onToggle(item.key)} className="w-full flex items-center gap-2.5 text-left py-1">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isChecked ? 'bg-accent border-accent' : 'border-border'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className={`text-sm flex-1 ${isChecked ? 'line-through text-muted' : ''}`}>{item.foodName}</span>
                      {fiberRounded > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isChecked ? 'text-muted' : fiberRounded >= 5 ? 'bg-ok/10 text-ok font-semibold' : 'bg-bg-alt text-muted'
                        }`} title="Fibra">
                          {fiberRounded}g fibra
                        </span>
                      )}
                      <span className="text-xs text-muted">{qtyLabel}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pills de colores por macro — proteína en azul, carbohidratos en ámbar,
 * grasas en dorado, fibra en verde — para leer de un vistazo el perfil
 * nutricional de la comida sin tener que sumar cada ingrediente. */
function MealMacroPills({ items }: { items: DietMealItem[] }) {
  const totals = items.reduce((acc, i) => ({
    proteinG: acc.proteinG + (i.proteinG || 0), carbsG: acc.carbsG + (i.carbsG || 0),
    fatG: acc.fatG + (i.fatG || 0), fiberG: acc.fiberG + (i.fiberG || 0),
  }), { proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
  const pills = [
    { label: 'Prot.', value: totals.proteinG, className: 'bg-protein/10 text-protein' },
    { label: 'Carbos', value: totals.carbsG, className: 'bg-notice/10 text-notice' },
    { label: 'Grasas', value: totals.fatG, className: 'bg-fat/10 text-fat' },
    { label: 'Fibra', value: totals.fiberG, className: 'bg-ok/10 text-ok' },
  ].filter(p => p.value > 0)
  if (pills.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map(p => (
        <span key={p.label} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.className}`}>
          {Math.round(p.value * 10) / 10}g {p.label}
        </span>
      ))}
    </div>
  )
}

function MacroCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-2 py-3 text-center">
      <p className="text-lg font-serif font-bold">{value}{suffix}</p>
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
    </div>
  )
}
