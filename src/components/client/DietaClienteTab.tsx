import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DietMealRow, DietMealItemRow, DietSupplementRow } from '../../lib/supabase-types'
import { dietPlanFromRows } from '../../lib/mappers'
import { DietPlan, ClientData } from '../../types'
import { printDietPlan } from '../../lib/printPlan'
import { Utensils, ShoppingCart, Check, Download } from 'lucide-react'

interface ShoppingItem { key: string; foodName: string; unit: string; totalQty: number | null; parts: string[]; fiberG: number }

function buildShoppingList(plan: DietPlan): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>()
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      if (!item.foodName.trim()) continue
      const key = `${item.foodName.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`
      const qtyNum = parseFloat(item.quantity.replace(',', '.'))
      const fiber = item.fiberG || 0
      const existing = map.get(key)
      if (existing) {
        existing.totalQty = existing.totalQty !== null && !isNaN(qtyNum) ? existing.totalQty + qtyNum : null
        if (item.quantity) existing.parts.push(item.quantity)
        existing.fiberG += fiber
      } else {
        map.set(key, {
          key, foodName: item.foodName.trim(), unit: item.unit.trim(),
          totalQty: isNaN(qtyNum) ? null : qtyNum, parts: item.quantity ? [item.quantity] : [], fiberG: fiber,
        })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.foodName.localeCompare(b.foodName))
}

export function DietaClienteTab({ client }: { client: ClientData }) {
  const clientId = client.id
  const [plan, setPlan] = useState<DietPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggleChecked = (key: string) => setChecked(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  useEffect(() => {
    (async () => {
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
  }, [clientId])

  if (loading) return null

  if (!plan) return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-muted">
      <Utensils className="w-12 h-12 mx-auto mb-4 opacity-20" />
      <p className="font-serif text-xl font-bold mb-2">Sin plan de dieta</p>
      <p className="text-sm">Tu nutricionista aún no ha creado tu plan. ¡Pronto lo tendrás!</p>
    </div>
  )

  const visibleSupplements = plan.supplements.filter(s => s.visibleToClient)

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

      <div className="space-y-3">
        {plan.meals.map(meal => (
          <div key={meal.id} className="bg-card border border-border rounded-2xl p-4">
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
                  <li key={item.id} className="text-sm text-muted flex justify-between">
                    <span>{item.foodName}</span>
                    <span>{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
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

      <ShoppingList plan={plan} checked={checked} onToggle={toggleChecked} />
    </div>
  )
}

function ShoppingList({ plan, checked, onToggle }: { plan: DietPlan; checked: Set<string>; onToggle: (key: string) => void }) {
  const items = buildShoppingList(plan)
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
