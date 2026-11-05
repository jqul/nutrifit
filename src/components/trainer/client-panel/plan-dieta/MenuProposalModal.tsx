import { useMemo, useState } from 'react'
import { RecipeRow } from '../../../../lib/supabase-types'
import { proposeMenu, proposeWeek, ProposedMeal } from '../../../../lib/menuProposal'
import { mealTypeLabel } from '../../../../lib/recipeMeta'
import { DAY_LABELS } from './planModel'
import { Modal } from '../../../shared/Modal'
import { Button } from '../../../shared/Button'
import { RefreshCw } from 'lucide-react'

/**
 * «Proponer menú desde mis recetas»: enseña un día, o una semana entera con variedad, armado con las recetas del
 * nutricionista y ajustado al objetivo del plan, para añadirlo o sustituir las comidas. No usa IA: reparte las kcal y elige
 * entre las recetas que ya existen.
 */
export function MenuProposalModal({ open, onClose, recipes, targetKcal, targetProteinG, allergies, dislikes = '', hasMeals, hasAnyMeals, onApply, onApplyWeek }: {
  open: boolean
  onClose: () => void
  recipes: RecipeRow[]
  targetKcal: number
  targetProteinG: number
  allergies: string
  /** Lo que no le gusta al cliente (texto libre). */
  dislikes?: string
  /** Si el plan ya tiene comidas en el día que se está editando, se ofrece sustituirlas además de añadir. */
  hasMeals: boolean
  /** Si el plan tiene alguna comida (para ofrecer sustituir todo el cuadrante semanal). */
  hasAnyMeals: boolean
  onApply: (meals: ProposedMeal[], mode: 'add' | 'replace') => void
  onApplyWeek: (days: ProposedMeal[][], mode: 'add' | 'replace') => void
}) {
  const [span, setSpan] = useState<'day' | 'week'>('day')
  const [variant, setVariant] = useState(0)
  const opts = { recipes, targetKcal, targetProteinG, allergies, dislikes, variant }
  const proposal = useMemo(() => proposeMenu(opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipes, targetKcal, targetProteinG, allergies, dislikes, variant])
  const week = useMemo(() => (span === 'week' ? proposeWeek(opts) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [span, recipes, targetKcal, targetProteinG, allergies, dislikes, variant])
  const filled = proposal.meals.filter(m => m.recipe)
  const noTarget = !(targetKcal > 0)
  const nothing = noTarget || recipes.length === 0
  const weekFilled = week ? week.days.map(d => d.meals.filter(m => m.recipe)) : []

  const chip = (value: 'day' | 'week', label: string) => (
    <button onClick={() => setSpan(value)} aria-pressed={span === value}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${span === value ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>{label}</button>
  )

  return (
    <Modal open={open} onClose={onClose} title="Proponer menú desde mis recetas" maxWidth="max-w-lg">
      <div className="p-5 space-y-4 overflow-y-auto">
        {noTarget ? (
          <p className="text-sm text-muted">Primero pon las kcal del objetivo del plan: el menú se reparte a partir de ellas.</p>
        ) : recipes.length === 0 ? (
          <p className="text-sm text-muted">Todavía no tienes recetas. Crea algunas en Planes y recursos → Recetas y vuelve aquí.</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5" role="group" aria-label="Qué proponer">
              {chip('day', 'Un día')}{chip('week', 'Toda la semana')}
            </div>
            <p className="text-xs text-muted">
              Reparte {targetKcal} kcal en {proposal.meals.length} comidas y elige una receta tuya para cada una, con las cantidades ajustadas.
              {allergies.trim() && dislikes.trim() ? ' Se saltan las que chocan con sus alergias o llevan algo que no le gusta.' : allergies.trim() ? ' Se saltan las que chocan con sus alergias.' : dislikes.trim() ? ' Se saltan las que llevan algo que no le gusta.' : ''}
              {span === 'week' ? ' En la semana, ninguna receta sale más de dos veces ni en el mismo hueco dos días seguidos (si tienes recetas de sobra).' : ''} Es una propuesta: puedes ajustarla después.
            </p>

            {span === 'day' ? (
              <>
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
                        <p className="text-sm text-warn mt-0.5">Ninguna receta encaja (revisa su tipo de comida, su tamaño, las alergias o lo que no le gusta).</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{Math.round(proposal.totalKcal)} kcal</span>
                  <span className="text-muted"> · {Math.round(proposal.totalProteinG)} g de proteína{targetProteinG > 0 ? ` (objetivo ${targetProteinG} g)` : ''}</span>
                </p>
              </>
            ) : week && (
              <>
                <div className="space-y-1.5" aria-label="Semana propuesta">
                  {week.days.map((d, i) => (
                    <div key={i} className="bg-bg-alt rounded-xl px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">{DAY_LABELS[i]}</p>
                      <ul className="text-xs mt-0.5 space-y-0.5">
                        {d.meals.map(m => (
                          <li key={m.slot.name} className="flex gap-1.5">
                            <span className="text-muted w-16 flex-shrink-0">{m.slot.name}</span>
                            {m.recipe ? <span className="font-medium">{m.recipe.name}</span> : <span className="text-warn">sin receta que encaje</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">{week.distinctRecipes} recetas distintas</span>
                  {week.mostRepeated && <> · la que más se repite: {week.mostRepeated.name} ({week.mostRepeated.count} veces)</>}
                  {week.emptySlots > 0 && <span className="text-warn"> · {week.emptySlots} {week.emptySlots === 1 ? 'hueco' : 'huecos'} sin receta</span>}
                </p>
                {hasAnyMeals && <p className="text-xs text-muted">El plan ya tiene comidas: «Añadir» las deja como están y suma estas por días; «Sustituir todo» las quita antes.</p>}
              </>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {span === 'day' ? (
            <>
              <Button size="sm" onClick={() => onApply(filled, 'add')} disabled={filled.length === 0}>Añadir al plan</Button>
              {hasMeals && <Button size="sm" variant="outline" onClick={() => onApply(filled, 'replace')} disabled={filled.length === 0}>Sustituir las comidas</Button>}
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => onApplyWeek(weekFilled, 'add')} disabled={weekFilled.every(d => d.length === 0)}>Añadir la semana</Button>
              {hasAnyMeals && <Button size="sm" variant="outline" onClick={() => onApplyWeek(weekFilled, 'replace')} disabled={weekFilled.every(d => d.length === 0)}>Sustituir todo</Button>}
            </>
          )}
          <button onClick={() => setVariant(v => v + 1)} disabled={nothing}
            className="flex items-center gap-1 text-xs font-bold text-accent disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" /> Otra propuesta</button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  )
}
