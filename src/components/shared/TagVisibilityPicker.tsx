import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/** Las etiquetas que ya usa el nutricionista en sus clientes (sin repetir, ordenadas). */
export function useClientTags(nutricionistaId: string, demoMode?: boolean): string[] {
  const [tags, setTags] = useState<string[]>(demoMode ? ['Deportista', 'Ganancia muscular', 'Pérdida de grasa - Nivel 1', 'Riesgo de abandono'] : [])
  useEffect(() => {
    if (demoMode) return
    supabase.from('clientes').select('tags').eq('nutricionista_id', nutricionistaId)
      .then(({ data }) => setTags(Array.from(new Set((data || []).flatMap(r => (r.tags as string[] | null) || []))).sort()))
  }, [nutricionistaId, demoMode])
  return tags
}

/**
 * «¿Quién lo ve?»: todos los clientes o solo los que tengan alguna de las etiquetas elegidas. Lo que se guarda es la
 * lista de etiquetas; vacía = todos. Las etiquetas se ponen a cada cliente en su Perfil.
 */
export function TagVisibilityPicker({ value, onChange, available, what }: {
  value: string[]; onChange: (tags: string[]) => void; available: string[]
  /** «esta receta», «esta guía»… */
  what: string
}) {
  const restricted = value.length > 0
  // Etiquetas elegidas que ya no existen en ningún cliente: se siguen mostrando para poder quitarlas.
  const options = Array.from(new Set([...available, ...value])).sort()
  const toggle = (tag: string) => onChange(value.includes(tag) ? value.filter(t => t !== tag) : [...value, tag])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={`Quién ve ${what}`}>
        <span className="text-xs text-muted">Quién la ve:</span>
        <button type="button" onClick={() => onChange([])} aria-pressed={!restricted}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${!restricted ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>Todos mis clientes</button>
        <button type="button" onClick={() => { if (!restricted && options.length > 0) onChange([options[0]]) }} aria-pressed={restricted}
          disabled={options.length === 0}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${restricted ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>Solo con etiqueta…</button>
      </div>
      {options.length === 0 && <p className="text-xs text-muted">Para limitarlo por etiquetas, primero ponles etiquetas a tus clientes (en su Perfil).</p>}
      {restricted && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etiquetas que pueden verlo">
          {options.map(tag => (
            <button key={tag} type="button" onClick={() => toggle(tag)} aria-pressed={value.includes(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${value.includes(tag) ? 'bg-accent text-white' : 'bg-accent/10 text-accent hover:bg-accent/20'}`}>#{tag}</button>
          ))}
          <p className="w-full text-xs text-muted">Solo los clientes con alguna de estas etiquetas ven {what}. Si quitas todas, la ven todos.</p>
        </div>
      )}
    </div>
  )
}
