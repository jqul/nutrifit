import { detectAllergenConflict } from '../../../../lib/allergens'
import { detectDrugInteraction } from '../../../../lib/drugNutrientInteractions'
import { EditableMeal, sumItemMacros, DAY_LABELS } from './planModel'
import { AlertTriangle, Pencil, Pill } from 'lucide-react'

/**
 * Comida en modo lectura (UX-12): lo que antes era un formulario siempre
 * abierto con cinco iconos por alimento pasa a ser una tarjeta legible —
 * nombre, hora, kcal, alimentos con cantidades y total de macros — con un
 * botón "Editar" que abre el formulario completo. Los avisos de alergia y de
 * interacción fármaco-nutriente se muestran también aquí: son de seguridad y
 * no deben esconderse tras un clic.
 */
export function MealSummary({ meal, isGroup, allergies, medication, personalMode, onEdit }: {
  meal: EditableMeal
  isGroup: boolean
  allergies: string
  medication: string
  personalMode?: boolean
  onEdit: () => void
}) {
  const totals = sumItemMacros(meal.items)
  const r1 = (n: number) => Math.round(n * 10) / 10

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold flex items-center gap-2 flex-wrap">
            {isGroup && meal.optionLabel && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{meal.optionLabel}</span>
            )}
            <span className="truncate">{meal.name || 'Comida sin nombre'}</span>
          </p>
          <p className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-2">
            {meal.time && <span>{meal.time}</span>}
            <span>{Math.round(totals.kcal)} kcal{meal.kcalTarget ? ` · objetivo ${meal.kcalTarget}` : ''}</span>
            {meal.dayOfWeek != null && <span>· {DAY_LABELS[meal.dayOfWeek]}</span>}
            {meal.dayType && <span>· {meal.dayType === 'on' ? '🔥 Día ON' : '🌙 Día OFF'}</span>}
          </p>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1 text-xs font-bold text-accent flex-shrink-0 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
      </div>

      <ul className="space-y-1.5">
        {meal.items.map(item => {
          const allergenHit = detectAllergenConflict(allergies, item.foodName)
          const drugHit = detectDrugInteraction(medication, item.foodName)
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{item.foodName || 'Alimento sin nombre'}</span>
                {allergenHit && (
                  <span title={`${personalMode ? 'Posible alérgeno para ti' : 'Posible alérgeno para este cliente'}: ${allergenHit.replace('_', ' ')}`} className="text-warn flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </span>
                )}
                {drugHit && (
                  <span title={drugHit.warning} className="text-warn flex-shrink-0"><Pill className="w-3.5 h-3.5" /></span>
                )}
              </span>
              <span className="text-muted flex-shrink-0">{item.quantity} {item.unit}</span>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted bg-bg-alt rounded-xl px-3 py-2 flex flex-wrap gap-x-3">
        <span><strong className="text-ink">{r1(totals.proteinG)}</strong> g prot.</span>
        <span><strong className="text-ink">{r1(totals.carbsG)}</strong> g carbos</span>
        <span><strong className="text-ink">{r1(totals.fatG)}</strong> g grasas</span>
        <span><strong className="text-ink">{r1(totals.fiberG)}</strong> g fibra</span>
      </p>
    </div>
  )
}
