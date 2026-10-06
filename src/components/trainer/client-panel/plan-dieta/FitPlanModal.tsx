import { FitResult, FitTargets, FitTotals } from '../../../../lib/planFit'
import { Button } from '../../../shared/Button'
import { Modal } from '../../../shared/Modal'

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

const ROWS: { key: keyof FitTotals; label: string; unit: string; target?: keyof FitTargets }[] = [
  { key: 'kcal', label: 'Kcal', unit: '', target: 'kcal' },
  { key: 'proteinG', label: 'Proteína', unit: ' g', target: 'proteinG' },
  { key: 'carbsG', label: 'Carbohidratos', unit: ' g', target: 'carbsG' },
  { key: 'fatG', label: 'Grasas', unit: ' g', target: 'fatG' },
  { key: 'fiberG', label: 'Fibra', unit: ' g' },
]

/**
 * Vista previa de "Ajustar comidas al objetivo": qué cambiaría en cada comida y
 * cómo quedan las sumas. No guarda nada: "Aplicar" solo cambia el borrador del
 * editor, y el plan no se guarda hasta que se pulsa "Guardar plan".
 */
export function FitPlanModal({ open, onClose, fit, targets, scopeLabel, sharedNote, onApply }: {
  open: boolean; onClose: () => void
  fit: FitResult | null; targets: FitTargets
  /** Qué se está ajustando: "Lunes · día ON", "Todas las comidas"… */
  scopeLabel: string
  /** Aviso extra (comidas compartidas con otros días). */
  sharedNote?: string | null
  onApply: () => void
}) {
  if (!fit) return null

  // Los cambios agrupados por comida, en el orden en que aparecen.
  const byMeal: { mealId: string; mealName: string; kind: 'slot' | 'option'; rows: { id: string; text: string }[] }[] = []
  for (const c of fit.changes) {
    let group = byMeal.find(g => g.mealId === c.mealId)
    if (!group) { group = { mealId: c.mealId, mealName: c.mealName, kind: c.kind, rows: [] }; byMeal.push(group) }
    group.rows.push({ id: c.itemId, text: `${c.foodName}: ${fmt(c.from)} → ${fmt(c.to)} ${c.unit}` })
  }

  const canApply = fit.changes.length > 0

  return (
    <Modal open={open} onClose={onClose} title="Ajustar comidas al objetivo" maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Cambia las cantidades de <strong className="text-ink">{scopeLabel}</strong> para que sumen el objetivo de kcal, tocando lo menos posible
          y acercando a la vez cada macro a su objetivo. La verdura y los suplementos no se mueven.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="font-medium py-1.5">Suma del día</th>
                <th className="font-medium py-1.5 text-right">Ahora</th>
                <th className="font-medium py-1.5 text-right">Con el ajuste</th>
                <th className="font-medium py-1.5 text-right">Objetivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ROWS.map(r => (
                <tr key={r.key}>
                  <td className="py-1.5 font-medium">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{fmt(fit.before[r.key])}{r.unit}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(fit.after[r.key])}{r.unit}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.target && targets[r.target] ? `${fmt(targets[r.target])}${r.unit}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {byMeal.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Qué cambia ({fit.changes.length})</p>
            {byMeal.map(g => (
              <div key={g.mealId} className="bg-bg-alt/60 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold mb-1">
                  {g.mealName || 'Comida'}{g.kind === 'option' && <span className="font-normal text-muted"> · opción alternativa, con la misma proporción que su comida</span>}
                </p>
                <ul className="text-xs text-muted space-y-0.5">
                  {g.rows.map(r => <li key={r.id}>{r.text}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted bg-bg-alt/60 rounded-xl px-3 py-2.5">No hay cantidades que cambiar.</p>
        )}

        {(fit.notes.length > 0 || sharedNote) && (
          <ul className="text-xs text-muted space-y-1 list-disc pl-4">
            {fit.notes.map(n => <li key={n}>{n}</li>)}
            {sharedNote && <li>{sharedNote}</li>}
          </ul>
        )}

        <p className="text-xs text-muted">Es una propuesta: no se guarda nada hasta que pulses «Guardar plan».</p>
        <div className="flex gap-2">
          <Button onClick={onApply} disabled={!canApply}>Aplicar al plan</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
