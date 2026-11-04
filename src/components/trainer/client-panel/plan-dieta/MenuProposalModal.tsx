import { useMemo, useState } from 'react'
import { RecipeRow } from '../../../../lib/supabase-types'
import { proposeMenu, ProposedMeal } from '../../../../lib/menuProposal'
import { mealTypeLabel } from '../../../../lib/recipeMeta'
import { Modal } from '../../../shared/Modal'
import { Button } from '../../../shared/Button'
import { RefreshCw } from 'lucide-react'

/**
 * «Proponer menú desde mis recetas»: enseña un día armado con las recetas del nutricionista, ajustado al objetivo del
 * plan, para añadirlo o sustituir las comidas. No usa IA: reparte las kcal y elige entre las recetas que ya existen.
 */
export function MenuProposalModal({ open, onClose, recipes, targetKcal, targetProteinG, allergies, hasMeals, onApply }: {
  open: boolean
  onClose: () => void
  recipes: RecipeRow[]
  targetKcal: number
  targetProteinG: number
  allergies: string
  /** Si el plan ya tiene comidas en el día que se está editando, se ofrece sustituirlas además de añadir. */
  hasMeals: boolean
  onApply: (meals: ProposedMeal[], mode: 'add' | 'replace') => void
}) {
  const [variant, setVariant] = useState(0)
  const proposal = useMemo(
    () => proposeMenu({ recipes, targetKcal, targetProteinG, allergies, variant }),
    [recipes, targetKcal, targetProteinG, allergies, variant],
  )
  const filled = proposal.meals.filter(m => m.recipe)
  const noTarget = !(targetKcal > 0)

  return (
    <Modal open={open} onClose={onClose} title="Proponer menú desde mis recetas" maxWidth="max-w-lg">
      <div className="p-5 space-y-4 overflow-y-auto">
        {noTarget ? (
          <p className="text-sm text-muted">Primero pon las kcal del objetivo del plan: el menú se reparte a partir de ellas.</p>
        ) : recipes.length === 0 ? (
          <p className="text-sm text-muted">Todavía no tienes recetas. Crea algunas en Planes y recursos → Recetas y vuelve aquí.</p>
        ) : (
          <>
            <p className="text-xs text-muted">
              Reparte {targetKcal} kcal en {proposal.meals.length} comidas y elige una receta tuya para cada una, con las cantidades ajustadas.
              {allergies.trim() ? ' Se saltan las que chocan con sus alergias.' : ''} Es una propuesta: puedes ajustarla después.
            </p>
            <div className="space-y-2">
              {proposal.meals.map(m => (
                <div key={m.slot.name} className="bg-bg-alt rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">{m.slot.name} · {m.kcalTarget} kcal</p>
                    {m.recipe && <span className="text-xs text-muted">×{String(Math.round(m.factor * 100) / 100).replace('.', ',')}</span>}
                  </div>
                  {m.recipe ? (
                    <p className="text-sm font-semibold mt-0.5">
                      {m.recipe.name}
                      {m.recipe.meal_type && <span className="ml-2 text-xs font-normal text-muted">{mealTypeLabel(m.recipe.meal_type)}</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-warn mt-0.5">Ninguna receta encaja (revisa su tipo de comida, su tamaño o las alergias).</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm">
              <span className="font-semibold">{Math.round(proposal.totalKcal)} kcal</span>
              <span className="text-muted"> · {Math.round(proposal.totalProteinG)} g de proteína{targetProteinG > 0 ? ` (objetivo ${targetProteinG} g)` : ''}</span>
            </p>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onApply(filled, 'add')} disabled={filled.length === 0}>Añadir al plan</Button>
          {hasMeals && <Button size="sm" variant="outline" onClick={() => onApply(filled, 'replace')} disabled={filled.length === 0}>Sustituir las comidas</Button>}
          <button onClick={() => setVariant(v => v + 1)} disabled={noTarget || recipes.length === 0}
            className="flex items-center gap-1 text-xs font-bold text-accent disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" /> Otra propuesta</button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  )
}
