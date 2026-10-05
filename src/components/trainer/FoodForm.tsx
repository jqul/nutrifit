import { useMemo, useState } from 'react'
import { Food } from '../../types'
import { FOOD_CATEGORIES, FoodDraft, validateFoodDraft } from '../../lib/foodDraft'
import { Button } from '../shared/Button'

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}

/**
 * Formulario de un alimento propio (alta y edición). Todos los valores son por
 * 100 g. Valida antes de guardar y avisa, sin bloquear, de valores que no cuadran.
 */
export function FoodForm({ draft, onChange, existing, editingId = null, nameLocked = false, nameLockedHint, saving, submitLabel, onSubmit, onCancel }: {
  draft: FoodDraft; onChange: (d: FoodDraft) => void
  /** Los alimentos que ya ve el nutricionista (sistema + propios), para no repetir nombres. */
  existing: Food[]
  editingId?: string | null
  nameLocked?: boolean; nameLockedHint?: string
  saving: boolean; submitLabel: string
  onSubmit: () => void; onCancel: () => void
}) {
  const [attempted, setAttempted] = useState(false)
  const validation = useMemo(() => validateFoodDraft(draft, existing, editingId), [draft, existing, editingId])
  const set = (patch: Partial<FoodDraft>) => onChange({ ...draft, ...patch })

  const submit = () => {
    setAttempted(true)
    if (validation.errors.length === 0) onSubmit()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={draft.name} onChange={e => set({ name: e.target.value })} placeholder="Nombre del alimento" aria-label="Nombre del alimento"
          autoFocus={!nameLocked} disabled={nameLocked} maxLength={100}
          className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60" />
        <select value={draft.category} onChange={e => set({ category: e.target.value })} aria-label="Categoría"
          className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
          {FOOD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {nameLocked && nameLockedHint && <p className="text-xs text-muted">{nameLockedHint}</p>}
      <p className="text-xs text-muted">Todos los valores son por 100 g. Kcal, proteína, carbohidratos y grasa son obligatorios (0 si no tiene); el resto, opcional.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <NumField label="Kcal *" value={draft.kcal} onChange={v => set({ kcal: v })} />
        <NumField label="Prot. (g) *" value={draft.proteinG} onChange={v => set({ proteinG: v })} />
        <NumField label="Carbos (g) *" value={draft.carbsG} onChange={v => set({ carbsG: v })} />
        <NumField label="Grasas (g) *" value={draft.fatG} onChange={v => set({ fatG: v })} />
        <NumField label="Fibra (g)" value={draft.fiberG} onChange={v => set({ fiberG: v })} />
        <NumField label="Azúcares (g)" value={draft.sugarG} onChange={v => set({ sugarG: v })} />
        <NumField label="Sodio (mg)" value={draft.sodiumMg} onChange={v => set({ sodiumMg: v })} />
        <NumField label="Sat. (g)" value={draft.saturatedFatG} onChange={v => set({ saturatedFatG: v })} />
        <NumField label="Calcio (mg)" value={draft.calciumMg} onChange={v => set({ calciumMg: v })} />
        <NumField label="Hierro (mg)" value={draft.ironMg} onChange={v => set({ ironMg: v })} />
        <NumField label="Zinc (mg)" value={draft.zincMg} onChange={v => set({ zincMg: v })} />
      </div>

      {attempted && validation.errors.length > 0 && (
        <ul role="alert" className="text-xs text-warn space-y-0.5 list-disc pl-4">
          {validation.errors.map(e => <li key={e}>{e}</li>)}
        </ul>
      )}
      {validation.warnings.length > 0 && (
        <ul className="text-xs text-muted space-y-0.5 list-disc pl-4">
          {validation.warnings.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={submit} loading={saving}>{submitLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </div>
    </div>
  )
}
