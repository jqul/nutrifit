import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DietMealRow, DietMealItemRow, DietSupplementRow } from '../../lib/supabase-types'
import { dietPlanFromRows } from '../../lib/mappers'
import { DietPlan } from '../../types'
import { Utensils } from 'lucide-react'

export function DietaClienteTab({ clientId }: { clientId: string }) {
  const [plan, setPlan] = useState<DietPlan | null>(null)
  const [loading, setLoading] = useState(true)

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
      <div className="grid grid-cols-4 gap-2">
        <MacroCard label="Kcal" value={plan.kcalTarget} />
        <MacroCard label="Prot." value={plan.proteinG} suffix="g" />
        <MacroCard label="Carbos" value={plan.carbsG} suffix="g" />
        <MacroCard label="Grasas" value={plan.fatG} suffix="g" />
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
