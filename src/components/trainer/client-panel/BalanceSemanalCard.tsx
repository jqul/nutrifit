import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { dietPlanFromRows } from '../../../lib/mappers'
import { DietPlan, MealLog } from '../../../types'
import { DEMO_DIET_PLANS } from '../../../lib/demo-data'
import { toLocalISODate } from '../../../lib/date'
import { balanceByDay } from '../../../lib/dayBalance'
import { DayBalanceBar } from '../../shared/DayBalanceBar'

const DAYS = 7

/**
 * Qué ha comido el cliente cada día frente a su objetivo: las comidas del plan que ha marcado como hechas (con las
 * cantidades del plan) más lo que ha escaneado fuera del plan. Es lo que permite ver que "se desajusta" por comer cosas
 * ajenas a la dieta.
 */
export function BalanceSemanalCard({ clientId, mealLogs, demoMode }: { clientId: string; mealLogs: MealLog[]; demoMode?: boolean }) {
  const [plan, setPlan] = useState<DietPlan | null>(demoMode ? DEMO_DIET_PLANS[clientId] ?? null : null)

  useEffect(() => {
    if (demoMode) { setPlan(DEMO_DIET_PLANS[clientId] ?? null); return }
    let cancelled = false
    ;(async () => {
      const { data: planRow } = await supabase.from('diet_plans').select('*').eq('client_id', clientId).eq('is_active', true).maybeSingle()
      if (!planRow) { if (!cancelled) setPlan(null); return }
      const { data: mealRows } = await supabase.from('diet_meals').select('*').eq('plan_id', planRow.id).order('sort_order')
      const mealIds = (mealRows || []).map((m: { id: string }) => m.id)
      const { data: itemRows } = mealIds.length > 0
        ? await supabase.from('diet_meal_items').select('*').in('meal_id', mealIds)
        : { data: [] }
      if (!cancelled) setPlan(dietPlanFromRows(planRow, mealRows || [], itemRows || [], []))
    })()
    return () => { cancelled = true }
  }, [clientId, demoMode])

  const days = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate() - (DAYS - 1))
    return balanceByDay(plan?.meals ?? [], plan?.kcalTarget || null, mealLogs, toLocalISODate(from))
  }, [plan, mealLogs])

  if (days.length === 0) return null
  const extrasKcal = days.reduce((s, d) => s + d.extras.kcal, 0)
  const extrasCount = days.reduce((s, d) => s + d.extrasCount, 0)

  return (
    <div className="card p-5 space-y-3">
      <p className="font-semibold text-sm">Balance de los últimos {DAYS} días</p>
      {extrasCount > 0 && (
        <div className="rounded-xl bg-warn/10 px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-warn">Fuera del plan</p>
          <p className="text-sm mt-0.5">
            <span className="font-semibold">{extrasKcal} kcal</span> en {extrasCount} {extrasCount === 1 ? 'producto escaneado' : 'productos escaneados'}
            <span className="text-muted"> · {Math.round(extrasKcal / DAYS)} kcal de media al día</span>
          </p>
        </div>
      )}
      <ul className="space-y-3">
        {days.map(d => (
          <li key={d.date} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold capitalize">
                {new Date(d.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <p className="text-sm">
                <span className="font-semibold">{d.total.kcal} kcal</span>
                {d.targetKcal ? <span className="text-muted"> de {d.targetKcal}{d.pctOfTarget != null ? ` (${d.pctOfTarget}%)` : ''}</span> : null}
              </p>
            </div>
            <DayBalanceBar planKcal={d.plan.kcal} extrasKcal={d.extras.kcal} targetKcal={d.targetKcal} />
            <p className="text-xs text-muted">
              Plan {d.plan.kcal} kcal ({d.doneMeals} {d.doneMeals === 1 ? 'comida' : 'comidas'})
              {d.extrasCount > 0 ? ` · Extras ${d.extras.kcal} kcal (${d.extrasCount})` : ''}
              {d.targetKcal && d.total.kcal > d.targetKcal ? <span className="font-semibold text-warn"> · +{d.total.kcal - d.targetKcal} kcal sobre el objetivo</span> : null}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Estimación: las comidas del plan que el cliente marca como hechas cuentan con las cantidades del plan, y los extras con lo que
        escanea. No recoge lo que come sin apuntarlo.
        {!plan && ' Sin plan de dieta activo: solo se ven los extras.'}
      </p>
    </div>
  )
}
