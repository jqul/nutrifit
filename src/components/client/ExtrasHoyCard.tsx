import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../shared/Toast'
import { MealLog } from '../../types'
import { ScannedExtra, scannedExtrasOf, sumExtras } from '../../lib/scannedLogs'
import { getMealLogsSnapshot, mealLogsOf, publishMealLogs } from '../../lib/mealProgress'

const comma = (n: number) => String(n).replace('.', ',')

/**
 * "Extras de hoy": los productos que el cliente ha escaneado y apuntado (un chicle, una galleta…) con su cantidad y sus
 * macros, y el total. Es donde se ve lo que se añade con el escáner; el resto del diario está en Progreso.
 */
export function ExtrasHoyCard({ logs, clientId, demoMode, kcalTarget, personalMode }: {
  logs: MealLog[]; clientId: string; demoMode?: boolean; kcalTarget?: number; personalMode?: boolean
}) {
  const [removing, setRemoving] = useState<string | null>(null)
  const extras = scannedExtrasOf(logs)
  if (extras.length === 0) return null
  const total = sumExtras(extras)

  const remove = async (extra: ScannedExtra) => {
    setRemoving(extra.log.id)
    if (demoMode) {
      publishMealLogs(clientId, mealLogsOf(getMealLogsSnapshot(), clientId).filter(l => l.id !== extra.log.id))
    } else {
      const { error } = await supabase.from('meal_logs').delete().eq('id', extra.log.id)
      if (error) { toast('No se pudo quitar: ' + error.message, 'warn'); setRemoving(null); return }
      window.dispatchEvent(new Event('nutrifit:meal-logged'))   // Hoy recarga el diario y Dieta y Progreso lo reflejan
    }
    setRemoving(null)
  }

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Extras de hoy</p>
        <p className="text-sm font-semibold">{total.kcal} kcal</p>
      </div>
      <ul className="space-y-2">
        {extras.map(({ log, info }) => (
          <li key={log.id} className="flex items-center gap-3 border border-border rounded-xl px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{log.mealName}</p>
              <p className="text-xs text-muted">{comma(info.grams)} g · {info.kcal} kcal · P {comma(info.proteinG)} · C {comma(info.carbsG)} · G {comma(info.fatG)}</p>
            </div>
            <button type="button" onClick={() => remove({ log, info })} disabled={removing === log.id}
              aria-label={`Quitar ${log.mealName}`}
              className="p-2 -mr-1 text-muted hover:text-warn rounded-lg disabled:opacity-40">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-2.5">
        {extras.length > 1 && <>Total: P {comma(total.proteinG)} g · C {comma(total.carbsG)} g · G {comma(total.fatG)} g. </>}
        {kcalTarget ? <>Es el {Math.round((total.kcal / kcalTarget) * 100)}% de tu objetivo diario. </> : null}
        {personalMode ? 'Queda apuntado en tu diario.' : 'Tu nutricionista lo ve en tu diario como comida fuera del plan.'}
      </p>
    </div>
  )
}
