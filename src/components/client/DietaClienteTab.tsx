import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DietMealRow, DietMealItemRow, DietSupplementRow } from '../../lib/supabase-types'
import { dietPlanFromRows, foodFromRow } from '../../lib/mappers'
import { DietPlan, DietMeal, ClientData, Food, DietMealItem } from '../../types'
import { printDietPlan } from '../../lib/printPlan'
import { buildShoppingList } from '../../lib/shoppingList'
import { gramsForAbsoluteMacro, MacroKey } from '../../lib/foodConversion'
import { Utensils, ShoppingCart, Check, Download, Repeat, CalendarDays, ChevronDown, ChevronUp, Layers, Flame, Moon } from 'lucide-react'

const MACRO_LABELS: Record<MacroKey, string> = { kcal: 'kcal', proteinG: 'proteína', carbsG: 'carbohidratos', fatG: 'grasas' }
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
/** JS Date.getDay() es 0=domingo...6=sábado; aquí usamos 0=lunes...6=domingo. */
function todayDayOfWeek(): number { return (new Date().getDay() + 6) % 7 }

/** Agrupa comidas por optionGroup (pauta flexible por opciones) — cada grupo
 * es un array de 1+ comidas; sin optionGroup = grupo de 1 (comida fija de
 * siempre, sin cambios). Mantiene el orden de aparición del array original. */
function groupMeals(meals: DietMeal[]): DietMeal[][] {
  const groups: DietMeal[][] = []
  const byGroupId = new Map<string, DietMeal[]>()
  for (const m of meals) {
    if (m.optionGroup) {
      let g = byGroupId.get(m.optionGroup)
      if (!g) { g = []; byGroupId.set(m.optionGroup, g); groups.push(g) }
      g.push(m)
    } else {
      groups.push([m])
    }
  }
  return groups
}

/** Para la lista de la compra: de cada grupo de opciones se queda solo con
 * la que el cliente ha elegido (o la primera si aún no ha elegido) — no
 * tiene sentido comprar ingredientes de alternativas que no va a cocinar.
 * Las comidas sin optionGroup se mantienen todas, sin cambios. */
function resolveChosenMeals(meals: DietMeal[], choices: Record<string, string>): DietMeal[] {
  return groupMeals(meals).map(g => {
    if (g.length === 1) return g[0]
    const groupId = g[0].optionGroup as string
    return g.find(m => m.id === choices[groupId]) || g[0]
  })
}

export function DietaClienteTab({ client, demoMode, demoPlan }: { client: ClientData; demoMode?: boolean; demoPlan?: DietPlan }) {
  const clientId = client.id
  const [plan, setPlan] = useState<DietPlan | null>(demoPlan ?? null)
  const [loading, setLoading] = useState(!demoPlan)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [foods, setFoods] = useState<Food[]>([])
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

  const toggleChecked = (key: string) => setChecked(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  useEffect(() => {
    if (!plan) { setOptionChoices({}); return }
    try {
      const raw = localStorage.getItem(`diet-option-choice:${plan.id}`)
      setOptionChoices(raw ? JSON.parse(raw) : {})
    } catch { setOptionChoices({}) }
  }, [plan?.id])

  const chooseOption = (groupId: string, mealId: string) => {
    setOptionChoices(prev => {
      const next = { ...prev, [groupId]: mealId }
      if (plan) { try { localStorage.setItem(`diet-option-choice:${plan.id}`, JSON.stringify(next)) } catch { /* ignore */ } }
      return next
    })
  }

  useEffect(() => {
    if (!plan) return
    try {
      const raw = localStorage.getItem(`diet-day-type:${plan.id}`)
      if (raw === 'on' || raw === 'off') setDayType(raw)
    } catch { /* ignore */ }
  }, [plan?.id])

  const chooseDayType = (v: 'on' | 'off') => {
    setDayType(v)
    if (plan) { try { localStorage.setItem(`diet-day-type:${plan.id}`, v) } catch { /* ignore */ } }
  }

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

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
      <div className="flex justify-end">
        <button onClick={() => printDietPlan(client, plan)}
          className="flex items-center gap-1.5 text-xs font-bold text-accent">
          <Download className="w-3.5 h-3.5" /> Descargar PDF
        </button>
      </div>
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
                const dayGroups = groupMeals(dayMeals)
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
        {groupMeals(visibleMeals).map(group => {
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
              {meal.items.length > 0 && (
                <ul className="space-y-1">
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

      <ShoppingList meals={resolveChosenMeals(plan.meals.filter(matchesDayType), optionChoices)} checked={checked} onToggle={toggleChecked} />
    </div>
  )
}

/** Fila de un ingrediente, con un botón opcional para ver alimentos
 * equivalentes ("sistema de intercambios") — puramente informativo: no
 * modifica el plan real, solo muestra por cuánto se podría cambiar
 * manteniendo el mismo macro. El cambio real solo lo hace el nutricionista. */
function MealItemRow({ item, foods, demoMode }: { item: DietMealItem; foods: Food[]; demoMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const [matchBy, setMatchBy] = useState<MacroKey>('proteinG')
  const [query, setQuery] = useState('')

  const itemMacro: Record<MacroKey, number | null> = {
    kcal: item.kcal, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG,
  }
  const canSubstitute = foods.length > 0

  const suggestions = query.trim().length > 0
    ? foods.filter(f => f.name.toLowerCase().includes(query.toLowerCase()) && f.name !== item.foodName).slice(0, 6)
    : []

  return (
    <li>
      <div className="text-sm text-muted flex justify-between items-center gap-2">
        <span className="flex-1">{item.foodName}</span>
        <span>{item.quantity} {item.unit}</span>
        {canSubstitute && (
          <button onClick={() => setOpen(v => !v)} title="Ver alimentos equivalentes"
            className={`p-1 flex-shrink-0 ${open ? 'text-accent' : 'text-muted hover:text-accent'}`}>
            <Repeat className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1.5 mb-1 pl-1 pr-1 pt-2 border-t border-border space-y-2">
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
          <div className="relative">
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Busca un equivalente a "${item.foodName}"...`}
              className="w-full px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
            {suggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map(f => {
                  const target = itemMacro[matchBy]
                  const grams = target != null ? gramsForAbsoluteMacro(f, target, matchBy) : null
                  return (
                    <div key={f.id} className="w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2">
                      <span>{f.name}</span>
                      <span className="text-muted flex-shrink-0">{grams != null ? `≈ ${Math.round(grams * 10) / 10}g` : 'sin ese macro'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted">
            Solo orientativo — coméntaselo a tu nutricionista antes de cambiarlo{demoMode ? ' (modo demo)' : ''}.
          </p>
        </div>
      )}
    </li>
  )
}

function ShoppingList({ meals, checked, onToggle }: { meals: DietMeal[]; checked: Set<string>; onToggle: (key: string) => void }) {
  const items = buildShoppingList(meals)
  if (items.length === 0) return null
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
        <ShoppingCart className="w-3.5 h-3.5" /> Lista de la compra
      </p>
      <p className="text-xs text-muted mb-3">Generada a partir de tu plan de dieta actual. Márcalos según los vayas comprando.</p>
      <ul className="space-y-1.5">
        {items.map(item => {
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
                <span className={`text-xs ${isChecked ? 'text-muted' : 'text-muted'}`}>{qtyLabel}</span>
              </button>
            </li>
          )
        })}
      </ul>
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
