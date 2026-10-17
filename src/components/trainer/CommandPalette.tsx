import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, CornerDownLeft } from 'lucide-react'
import { Command, filterCommands } from '../../lib/commands'

/**
 * "Buscar o ir a…": escribes lo que quieres hacer y llegas ahí (Ctrl+K o ⌘K). Flechas para moverte, Intro para elegir, Esc para cerrar.
 * `dynamic` añade resultados según lo escrito (la ayuda, por ejemplo).
 */
export function CommandPalette({ open, onClose, commands, dynamic }: {
  open: boolean
  onClose: () => void
  commands: Command[]
  dynamic?: (query: string) => Command[]
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setQuery(''); setIndex(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  const results = useMemo(() => {
    const base = filterCommands(commands, query, 8)
    const extra = query.trim().length >= 3 && dynamic ? dynamic(query).filter(d => !base.some(b => b.id === d.id)).slice(0, 3) : []
    return [...base, ...extra]
  }, [commands, query, dynamic])

  useEffect(() => { setIndex(0) }, [query])

  if (!open) return null

  const choose = (c: Command | undefined) => { if (!c) return; onClose(); c.run() }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[index]) }
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-start justify-center px-4 pt-[12vh] bg-ink/40 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Buscar o ir a" className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2.5 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted flex-shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} role="combobox" aria-expanded aria-controls="command-results"
            aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
            placeholder="¿Qué quieres hacer? (crear cita, importar, un cliente…)"
            className="w-full py-3.5 bg-transparent outline-none text-sm" />
          <kbd className="hidden sm:block text-[10px] text-muted border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.length === 0 && <li className="px-4 py-6 text-sm text-muted text-center">No encuentro nada con eso. Prueba con otra palabra, o mira la Ayuda.</li>}
          {results.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === index}>
              <button type="button" onMouseEnter={() => setIndex(i)} onClick={() => choose(c)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${i === index ? 'bg-accent/10' : ''}`}>
                <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                <span className="text-xs text-muted flex-shrink-0">{c.hint ?? c.group}</span>
                {i === index && <CornerDownLeft className="w-3.5 h-3.5 text-muted flex-shrink-0" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
