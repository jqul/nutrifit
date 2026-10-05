import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClientData, DailyCheckin, WeightEntry } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { DEMO_DIET_PLANS } from '../../../lib/demo-data'
import { AdjustmentPlan, suggestDietAdjustment } from '../../../lib/dietAdjustment'
import { toast } from '../../shared/Toast'

const dismissKey = (clientId: string) => `nutrifit.dietAdjustment.dismissed.${clientId}`
const readDismissed = (clientId: string): string | null => { try { return localStorage.getItem(dismissKey(clientId)) } catch { return null } }
const writeDismissed = (clientId: string, value: string) => { try { localStorage.setItem(dismissKey(clientId), value) } catch { /* sin almacenamiento: reaparecerá */ } }

const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES')

/**
 * Reajuste sugerido del plan: compara el ritmo de peso real con el que pide el
 * objetivo del cliente y, si se desvía, propone otra cifra de kcal. Nada cambia
 * hasta que el nutricionista pulsa "Aplicar" — y entonces queda en el historial
 * del plan y como versión (restaurable). Solo toca kcal y carbohidratos: las
 * comidas del plan las ajusta él.
 */
export function DietAdjustmentCard({ client, weights, checkins, demoMode }: {
  client: ClientData; weights: WeightEntry[]; checkins: DailyCheckin[]; demoMode: boolean
}) {
  const [plan, setPlan] = useState<(AdjustmentPlan & { id: string }) | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [kcalDraft, setKcalDraft] = useState('')
  const [applying, setApplying] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed(client.id))

  const loadPlan = useCallback(async () => {
    if (demoMode) {
      const p = DEMO_DIET_PLANS[client.id]
      setPlan(p ? { id: p.id, kcal_target: p.kcalTarget, protein_g: p.proteinG, carbs_g: p.carbsG, fat_g: p.fatG, fiber_g: p.fiberG, advice: p.advice, updatedAt: p.updatedAt } : null)
      setLoaded(true)
      return
    }
    const { data } = await supabase.from('diet_plans')
      .select('id, kcal_target, protein_g, carbs_g, fat_g, fiber_g, advice, updated_at').eq('client_id', client.id).eq('is_active', true).maybeSingle()
    setPlan(data ? {
      id: data.id, kcal_target: Number(data.kcal_target) || 0, protein_g: Number(data.protein_g) || 0, carbs_g: Number(data.carbs_g) || 0,
      fat_g: Number(data.fat_g) || 0, fiber_g: Number(data.fiber_g) || 0, advice: data.advice || '', updatedAt: new Date(data.updated_at).getTime(),
    } : null)
    setLoaded(true)
  }, [client.id, demoMode])

  useEffect(() => { loadPlan() }, [loadPlan])

  const result = useMemo(() => suggestDietAdjustment({
    weights, checkins, goal: client.goal, goalWeightKg: client.goalWeightKg, plan,
  }), [weights, checkins, client.goal, client.goalWeightKg, plan])

  // El borrador editable parte de la propuesta; el nutricionista puede corregir la cifra de kcal.
  useEffect(() => { setKcalDraft(result.proposal ? String(result.proposal.kcal_target) : '') }, [result.proposal])

  if (!loaded || !plan || result.kind === 'no_plan') return null

  const proposalKey = result.proposal ? `${plan.updatedAt}:${result.proposal.kcal_target}` : null
  if (result.kind === 'adjust' && proposalKey === dismissed) return null

  const draftKcal = parseInt(kcalDraft, 10)
  const draftValid = result.proposal != null && Number.isFinite(draftKcal) && draftKcal >= 800 && draftKcal <= 6000
  // Los carbohidratos acompañan a la cifra de kcal que se aplique (la proteína y la grasa no cambian).
  const draftCarbs = result.proposal && draftValid ? Math.max(0, Math.round(plan.carbs_g + (draftKcal - plan.kcal_target) / 4)) : null

  const apply = async () => {
    if (!result.proposal || !draftValid || draftCarbs == null) return
    if (demoMode) { toast('Modo demo: el plan no se modifica de verdad', 'ok'); return }
    setApplying(true)
    const { error } = await supabase.from('diet_plans').update({
      kcal_target: draftKcal, carbs_g: draftCarbs, updated_at: new Date().toISOString(),
      // El trigger de la BD lo anota en el historial y consume (vacía) este motivo.
      change_reason: result.historyReason,
    }).eq('id', plan.id)
    if (error) { setApplying(false); toast('No se pudo aplicar el reajuste: ' + error.message, 'warn'); return }
    // La instantánea no es crítica: si falla, el cambio ya está aplicado y anotado en el historial.
    const { error: versionError } = await supabase.rpc('create_plan_version', { p_plan_id: plan.id, p_note: result.historyReason })
    if (versionError) console.warn('No se pudo crear la versión del plan', versionError)
    setApplying(false)
    toast('Reajuste aplicado al plan ✓ — ajusta las cantidades de las comidas si hace falta', 'ok')
    await loadPlan()
  }

  const dismiss = () => {
    if (!proposalKey) return
    writeDismissed(client.id, proposalKey)
    setDismissed(proposalKey)
  }

  const accent = result.kind === 'adjust'
  return (
    <div className="card p-5 space-y-3">
      <div>
        <p className="font-semibold text-sm">Reajuste del plan</p>
        <p className="text-xs text-muted">Ritmo de peso real frente al que pide su objetivo</p>
      </div>

      <div className={`rounded-xl px-4 py-3 ${accent ? 'bg-accent/10' : 'bg-bg-alt/60'}`}>
        <p className={`text-sm leading-relaxed ${accent ? 'font-semibold' : 'text-muted'}`}>{result.headline}</p>
      </div>

      {result.reasons.length > 0 && (
        <ul className="text-xs text-muted space-y-1 list-disc pl-4">
          {result.reasons.map(r => <li key={r}>{r}</li>)}
        </ul>
      )}

      {result.kind === 'adjust' && result.proposal && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-bg-alt/60 rounded-xl p-3">
              <label htmlFor="adjust-kcal" className="text-xs text-muted block">Kcal al día</label>
              <p className="text-xs text-muted">{fmtInt(plan.kcal_target)} →</p>
              <input id="adjust-kcal" type="number" inputMode="numeric" step={25} value={kcalDraft} onChange={e => setKcalDraft(e.target.value)}
                className="w-full mt-0.5 px-2 py-1 bg-bg border border-border rounded-lg font-serif font-bold text-lg outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
            </div>
            <div className="bg-bg-alt/60 rounded-xl p-3">
              <p className="text-xs text-muted">Carbohidratos</p>
              <p className="text-xs text-muted">{fmtInt(plan.carbs_g)} g →</p>
              <p className="font-serif font-bold text-lg leading-tight mt-0.5">{draftCarbs == null ? '—' : `${fmtInt(draftCarbs)} g`}</p>
            </div>
            <div className="bg-bg-alt/60 rounded-xl p-3">
              <p className="text-xs text-muted">Proteína</p>
              <p className="font-serif font-bold text-lg leading-tight mt-1">{fmtInt(plan.protein_g)} g</p>
              <p className="text-xs text-muted">sin cambios</p>
            </div>
            <div className="bg-bg-alt/60 rounded-xl p-3">
              <p className="text-xs text-muted">Grasa</p>
              <p className="font-serif font-bold text-lg leading-tight mt-1">{fmtInt(plan.fat_g)} g</p>
              <p className="text-xs text-muted">sin cambios</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            Es una sugerencia orientativa, no un criterio clínico. Al aplicarla se actualizan los objetivos del plan (queda en el historial y como versión que puedes restaurar); las comidas no se modifican.
          </p>
          <div className="flex flex-wrap gap-2">
            <button disabled={applying || !draftValid} onClick={apply}
              className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-bold disabled:opacity-40">{applying ? 'Aplicando…' : 'Aplicar al plan'}</button>
            <button disabled={applying} onClick={dismiss}
              className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink">Ahora no</button>
          </div>
        </div>
      )}
    </div>
  )
}
