import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RecipeRow } from '../../lib/supabase-types'
import { Food } from '../../types'
import { toast } from './Toast'
import { Button } from './Button'
import { RecipePhotoUpload } from './RecipePhotoUpload'
import { Plus, Trash2, X } from 'lucide-react'

export interface EditableRecipeItem {
  id: string; foodName: string; quantity: string; unit: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
  fiberG: string; sugarG: string; sodiumMg: string; saturatedFatG: string
  calciumMg: string; ironMg: string; zincMg: string
}

function newId() { return crypto.randomUUID() }
function blankItem(): EditableRecipeItem {
  return { id: newId(), foodName: '', quantity: '', unit: '', kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '' }
}
function itemFromFood(food: Food): Partial<EditableRecipeItem> {
  return {
    foodName: food.name, quantity: '100', unit: 'g',
    kcal: String(food.kcal), proteinG: String(food.proteinG), carbsG: String(food.carbsG), fatG: String(food.fatG),
    fiberG: food.fiberG != null ? String(food.fiberG) : '', sugarG: food.sugarG != null ? String(food.sugarG) : '',
    sodiumMg: food.sodiumMg != null ? String(food.sodiumMg) : '', saturatedFatG: food.saturatedFatG != null ? String(food.saturatedFatG) : '',
    calciumMg: food.calciumMg != null ? String(food.calciumMg) : '', ironMg: food.ironMg != null ? String(food.ironMg) : '',
    zincMg: food.zincMg != null ? String(food.zincMg) : '',
  }
}

/**
 * Editor completo de una receta propia — nombre, foto, ingredientes (con
 * autocompletado de la base de alimentos) y pasos de preparación. Se usa
 * tanto en Plantillas como dentro del plan de un cliente (PlanDietaTab),
 * para no obligar a salir de ahí solo para arreglar una receta o añadirle
 * las instrucciones de cómo se hace.
 */
export function RecipeEditorPanel({ nutricionistaId, demoMode, foods, initial, onClose, onSaved }: {
  nutricionistaId: string
  demoMode?: boolean
  foods: Food[]
  initial: RecipeRow | null // null = receta nueva
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [steps, setSteps] = useState(initial?.steps || '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photo_url ?? null)
  const [items, setItems] = useState<EditableRecipeItem[]>(() => {
    const initialItems = ((initial?.items as EditableRecipeItem[] | null) || []).map(i => ({ ...i, id: i.id || newId() }))
    return initialItems.length ? initialItems : [blankItem()]
  })
  const [suggestFor, setSuggestFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const updateItem = (id: string, updates: Partial<EditableRecipeItem>) =>
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i))

  const handleSave = async () => {
    if (!name.trim()) { toast('Ponle un nombre a la receta', 'warn'); return }
    const cleanItems = items.filter(i => i.foodName.trim())
    if (cleanItems.length === 0) { toast('Añade al menos un alimento', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); onClose(); return }
    setSaving(true)
    const stepsValue = steps.trim() || null
    const { error } = initial
      ? await supabase.from('recipes').update({ name: name.trim(), steps: stepsValue, photo_url: photoUrl, items: cleanItems }).eq('id', initial.id)
      : await supabase.from('recipes').insert({ nutricionista_id: nutricionistaId, name: name.trim(), steps: stepsValue, photo_url: photoUrl, items: cleanItems })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(initial ? 'Receta actualizada ✓' : `Receta "${name.trim()}" creada ✓`, 'ok')
    onSaved()
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RecipePhotoUpload nutricionistaId={nutricionistaId} currentUrl={photoUrl} demoMode={demoMode} size="lg" onUploaded={setPhotoUrl} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la receta" autoFocus
          className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
        <button onClick={onClose} className="p-2 text-muted hover:text-warn"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-1.5">
        {items.map(item => {
          const suggestions = suggestFor === item.id && item.foodName.trim().length > 0
            ? foods.filter(f => f.name.toLowerCase().includes(item.foodName.toLowerCase())).slice(0, 6)
            : []
          return (
            <div key={item.id} className="relative flex items-center gap-1.5">
              <input value={item.foodName} onChange={e => updateItem(item.id, { foodName: e.target.value })}
                onFocus={() => setSuggestFor(item.id)} onBlur={() => setTimeout(() => setSuggestFor(null), 150)}
                placeholder="Alimento"
                className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
              <input value={item.quantity} onChange={e => updateItem(item.id, { quantity: e.target.value })} placeholder="Cant."
                className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
              <input value={item.unit} onChange={e => updateItem(item.id, { unit: e.target.value })} placeholder="Unidad"
                className="w-16 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
              <button onClick={() => setItems(items.filter(i => i.id !== item.id))}
                className="p-1.5 text-muted hover:text-warn flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              {suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {suggestions.map(f => (
                    <button key={f.id} type="button"
                      onMouseDown={() => { updateItem(item.id, itemFromFood(f)); setSuggestFor(null) }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                      <span>{f.name}</span>
                      <span className="text-muted flex-shrink-0">{f.kcal} kcal/100g</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <button onClick={() => setItems([...items, blankItem()])}
          className="flex items-center gap-1 text-xs text-muted hover:text-accent"><Plus className="w-3 h-3" /> Añadir alimento</button>
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Pasos de preparación (opcional, un paso por línea)</label>
        <textarea value={steps} onChange={e => setSteps(e.target.value)} rows={4}
          placeholder={'1. Cuece la pasta...\n2. Dora la carne...'}
          className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-xs outline-none resize-none focus:ring-2 focus:ring-accent/20" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} loading={saving}>Guardar receta</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  )
}
