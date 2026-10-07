import { useState } from 'react'
import { BottomSheet } from '../shared/BottomSheet'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/date'
import { ScannedFood, scannedFoodNote, scannedMacros } from '../../lib/openFoodFacts'
import { Barcode, BookPlus } from 'lucide-react'

const QUICK_GRAMS = [30, 50, 100, 150, 200]

/**
 * Lo que se hace con un producto escaneado: elegir cuánto se come, ver sus macros y, si se quiere, apuntarlo en el
 * diario de comidas (lo que ve también el nutricionista). Antes solo mostraba los valores por 100 g y no se podía hacer nada.
 */
export function ScannedFoodSheet({ food, clientId, demoMode, onClose, onScanAnother }: {
  food: ScannedFood; clientId: string; demoMode?: boolean
  onClose: () => void; onScanAnother: () => void
}) {
  const [gramsText, setGramsText] = useState('100')
  const [saving, setSaving] = useState(false)
  const grams = parseFloat(gramsText.replace(',', '.'))
  const valid = Number.isFinite(grams) && grams > 0 && grams <= 5000
  const m = scannedMacros(food, valid ? grams : 0)

  const addToDiary = async () => {
    if (!valid) return
    if (demoMode) { toast('Modo demo: no se guarda de verdad', 'ok'); onClose(); return }
    setSaving(true)
    const { error } = await supabase.from('meal_logs').insert({
      client_id: clientId, date: toLocalISODate(new Date()), meal_name: food.name, note: scannedFoodNote(food, grams), photo_url: null,
    })
    setSaving(false)
    if (error) { toast('No se pudo añadir al diario: ' + error.message, 'warn'); return }
    toast('Añadido a tu diario de hoy ✓ (lo ves en Progreso)', 'ok')
    window.dispatchEvent(new Event('nutrifit:meal-logged'))   // el diario de Progreso se recarga sin cerrar la app
    onClose()
  }

  return (
    <BottomSheet open onClose={onClose} title={food.name}>
      <div className="space-y-4">
        <div>
          <label htmlFor="scan-grams" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Cantidad (g)</label>
          <input id="scan-grams" type="text" inputMode="decimal" value={gramsText} onChange={e => setGramsText(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-base outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {QUICK_GRAMS.map(g => (
              <button key={g} type="button" onClick={() => setGramsText(String(g))}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${valid && grams === g ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>{g} g</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2" aria-live="polite">
          {[['Kcal', m.kcal, ''], ['Prot.', m.proteinG, 'g'], ['Carbos', m.carbsG, 'g'], ['Grasas', m.fatG, 'g']].map(([label, value, suffix]) => (
            <div key={label as string} className="bg-card border border-border rounded-xl px-2 py-3 text-center">
              <p className="text-lg font-serif font-bold">{String(value).replace('.', ',')}{suffix}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
        {!valid && <p className="text-xs text-warn">Pon una cantidad entre 1 y 5.000 g.</p>}

        <div className="space-y-2">
          <Button className="w-full" onClick={addToDiary} loading={saving} disabled={!valid}><BookPlus className="w-4 h-4" /> Añadir a mi diario de hoy</Button>
          <Button className="w-full" variant="outline" onClick={onScanAnother}><Barcode className="w-4 h-4" /> Escanear otro producto</Button>
        </div>
        <p className="text-xs text-muted">Valores por 100 g según Open Food Facts (base de datos pública y colaborativa): comprueba el envase.</p>
      </div>
    </BottomSheet>
  )
}
