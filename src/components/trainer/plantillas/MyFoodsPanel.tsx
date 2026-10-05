import { useMemo, useState } from 'react'
import { Food } from '../../../types'
import { FoodDraft, blankFoodDraft, foodToDraft } from '../../../lib/foodDraft'
import { countFoodUsage, createOwnFood, deleteOwnFood, updateOwnFood } from '../../../lib/ownFoods'
import { Button } from '../../shared/Button'
import { Modal } from '../../shared/Modal'
import { toast } from '../../shared/Toast'
import { FoodForm } from '../FoodForm'
import { Pencil, Plus, Trash2 } from 'lucide-react'

/** undefined = comprobando; null = no se pudo comprobar; número = platos de los planes donde aparece. */
type Usage = number | null | undefined

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/**
 * Mis alimentos: los alimentos propios del nutricionista (los que añade al
 * catálogo además de los del sistema). Se pueden crear, corregir y borrar. Los
 * platos que ya están en un plan guardan sus propios valores, así que corregir
 * un alimento no cambia planes ya hechos; borrarlo tampoco los rompe.
 */
export function MyFoodsPanel({ nutricionistaId, demoMode, foods, onFoodsChange }: {
  nutricionistaId: string; demoMode?: boolean
  /** Todo el catálogo que ve el nutricionista: sistema + propios. */
  foods: Food[]; onFoodsChange: (foods: Food[]) => void
}) {
  const own = useMemo(() => foods.filter(f => f.nutricionistaId === nutricionistaId).sort((a, b) => a.name.localeCompare(b.name, 'es')), [foods, nutricionistaId])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ draft: FoodDraft; editing: Food | null; usage: Usage } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<{ food: Food; usage: Usage } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const shown = query.trim() ? own.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase())) : own

  const openNew = () => setForm({ draft: blankFoodDraft(), editing: null, usage: null })
  const openEdit = async (food: Food) => {
    setForm({ draft: foodToDraft(food), editing: food, usage: undefined })
    const usage = demoMode ? 0 : await countFoodUsage(food.name)
    setForm(prev => (prev && prev.editing?.id === food.id ? { ...prev, usage } : prev))
  }

  const save = async () => {
    if (!form) return
    if (demoMode) {
      // Sin base de datos: el alimento vive solo mientras dure la sesión.
      const draftFood = { ...foodFromDraftLocal(form.draft, nutricionistaId), id: form.editing?.id ?? `demo-food-${Date.now()}` }
      onFoodsChange(form.editing ? foods.map(f => f.id === draftFood.id ? draftFood : f) : [...foods, draftFood])
      toast('Modo demo: el alimento no se guarda de verdad', 'ok')
      setForm(null)
      return
    }
    setSaving(true)
    const r = form.editing ? await updateOwnFood(form.editing.id, form.draft) : await createOwnFood(nutricionistaId, form.draft)
    setSaving(false)
    if (r.error !== undefined) { toast(r.error, 'warn'); return }
    onFoodsChange(form.editing ? foods.map(f => f.id === r.food.id ? r.food : f) : [...foods, r.food])
    toast(form.editing ? `«${r.food.name}» actualizado ✓` : `«${r.food.name}» añadido a tu catálogo ✓`, 'ok')
    setForm(null)
  }

  const askDelete = async (food: Food) => {
    setToDelete({ food, usage: undefined })
    const usage = demoMode ? 0 : await countFoodUsage(food.name)
    setToDelete(prev => (prev && prev.food.id === food.id ? { ...prev, usage } : prev))
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const { food } = toDelete
    if (demoMode) {
      onFoodsChange(foods.filter(f => f.id !== food.id))
      toast('Modo demo: el alimento no se borra de verdad', 'ok')
      setToDelete(null)
      return
    }
    setDeleting(true)
    const error = await deleteOwnFood(food.id)
    setDeleting(false)
    if (error) { toast(error, 'warn'); return }
    onFoodsChange(foods.filter(f => f.id !== food.id))
    toast(`«${food.name}» eliminado`, 'ok')
    setToDelete(null)
  }

  const nameLocked = !!form?.editing && (form.usage == null || form.usage > 0)   // sin saber dónde se usa, el nombre no se toca

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-sm">Mis alimentos ({own.length})</h2>
        {!form && (
          <button onClick={openNew} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Nuevo alimento
          </button>
        )}
      </div>

      {form && (
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3">{form.editing ? `Editar «${form.editing.name}»` : 'Nuevo alimento'}</p>
          <FoodForm draft={form.draft} onChange={draft => setForm({ ...form, draft })} existing={foods} editingId={form.editing?.id ?? null}
            nameLocked={nameLocked}
            nameLockedHint={form.usage === undefined ? 'Comprobando dónde se usa…' : form.usage === null ? 'No se pudo comprobar dónde se usa este alimento, así que el nombre no se puede cambiar ahora.' : `El nombre no se puede cambiar: aparece en ${form.usage} ${form.usage === 1 ? 'plato' : 'platos'} de tus planes, que lo enlazan por nombre.`}
            saving={saving} submitLabel={form.editing ? 'Guardar cambios' : 'Guardar alimento'} onSubmit={save} onCancel={() => setForm(null)} />
          {form.editing && <p className="text-xs text-muted mt-3">Los platos que ya están en planes conservan los valores con los que se añadieron.</p>}
        </div>
      )}

      {own.length === 0 && !form ? (
        <div className="card p-6 text-center space-y-2">
          <p className="text-sm font-semibold">Todavía no tienes alimentos propios</p>
          <p className="text-xs text-muted max-w-sm mx-auto">Añade los que no estén en el catálogo (un producto de marca, una receta base, un plato típico). Podrás usarlos en cualquier plan y tus clientes los verán con sus valores.</p>
          <Button size="sm" onClick={openNew}><Plus className="w-3.5 h-3.5" /> Añadir el primero</Button>
        </div>
      ) : (
        <>
          {own.length > 6 && (
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en mis alimentos…" aria-label="Buscar en mis alimentos"
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          )}
          <ul className="space-y-2">
            {shown.map(f => (
              <li key={f.id} className="card p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{f.name}</p>
                  <p className="text-xs text-muted">
                    {f.category} · {fmt(f.kcal)} kcal · P {fmt(f.proteinG)} · C {fmt(f.carbsG)} · G {fmt(f.fatG)} <span className="opacity-70">por 100 g</span>
                  </p>
                </div>
                <button onClick={() => openEdit(f)} title="Editar" aria-label={`Editar ${f.name}`} className="p-2 text-muted hover:text-accent"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => askDelete(f)} title="Eliminar" aria-label={`Eliminar ${f.name}`} className="p-2 text-muted hover:text-warn"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
            {shown.length === 0 && <li className="text-sm text-muted">Ningún alimento coincide con la búsqueda.</li>}
          </ul>
        </>
      )}

      <Modal open={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Eliminar alimento">
        {toDelete && (
          <div className="space-y-4">
            <p className="text-sm">¿Eliminar <span className="font-semibold">«{toDelete.food.name}»</span> de tu catálogo?</p>
            {toDelete.usage === undefined ? (
              <p className="text-xs text-muted">Comprobando dónde se usa…</p>
            ) : toDelete.usage === null ? (
              <p className="text-xs text-muted bg-bg-alt rounded-xl px-3 py-2">No se pudo comprobar si está en algún plan. Si lo está, esos platos seguirán con sus valores, pero ya no se podrán sugerir sustitutos para él.</p>
            ) : toDelete.usage > 0 ? (
              <p className="text-xs text-muted bg-bg-alt rounded-xl px-3 py-2">
                Aparece en {toDelete.usage} {toDelete.usage === 1 ? 'plato' : 'platos'} de tus planes. Seguirán ahí con sus valores, pero ya no se podrán sugerir sustitutos para ese alimento ni se agrupará bien en la lista de la compra.
              </p>
            ) : (
              <p className="text-xs text-muted">No está en ningún plan.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setToDelete(null)} disabled={deleting}>Cancelar</Button>
              <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting} disabled={toDelete.usage === undefined}>Eliminar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Un alimento en memoria a partir del borrador (solo demo, sin base de datos). */
function foodFromDraftLocal(d: FoodDraft, nutricionistaId: string): Food {
  const n = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : null }
  return {
    id: '', name: d.name.trim(), category: d.category, kcal: n(d.kcal) ?? 0, proteinG: n(d.proteinG) ?? 0, carbsG: n(d.carbsG) ?? 0, fatG: n(d.fatG) ?? 0,
    fiberG: n(d.fiberG), sugarG: n(d.sugarG), sodiumMg: n(d.sodiumMg), saturatedFatG: n(d.saturatedFatG),
    calciumMg: n(d.calciumMg), ironMg: n(d.ironMg), zincMg: n(d.zincMg), reference: 'Añadido por ti', nutricionistaId,
  }
}
