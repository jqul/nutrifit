import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { EatingOutGuideRow } from '../../lib/supabase-types'
import { DEFAULT_EATING_OUT_GUIDES } from '../../lib/eatingOutGuides'
import { DEMO_EATING_OUT_GUIDES } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { Button } from '../shared/Button'
import { UtensilsCrossed, Plus, Trash2, X, RotateCcw } from 'lucide-react'

function newId() { return crypto.randomUUID() }

interface EditorState { mode: 'new' | 'edit'; id?: string; emoji: string; label: string; tipsText: string }

const tipsToText = (tips: unknown) => (Array.isArray(tips) ? tips as string[] : []).join('\n')
const textToTips = (text: string) => text.split('\n').map(t => t.trim()).filter(Boolean)

/**
 * "¿Vas a comer fuera?" personalizable — por defecto el cliente ve el
 * contenido genérico de eatingOutGuides.ts; en cuanto el nutricionista crea
 * al menos una guía propia aquí, esa lista sustituye a la genérica en el
 * portal del cliente (ver DietaClienteTab.tsx).
 */
export function EatingOutGuidesManager({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const [rows, setRows] = useState<EatingOutGuideRow[]>(demoMode ? DEMO_EATING_OUT_GUIDES : [])
  const [loading, setLoading] = useState(!demoMode)
  const [editor, setEditor] = useState<EditorState | null>(null)

  const load = useCallback(async () => {
    if (demoMode) { setRows(DEMO_EATING_OUT_GUIDES); return }
    setLoading(true)
    const { data } = await supabase.from('eating_out_guides').select('*').eq('nutricionista_id', nutricionistaId).order('sort_order').order('created_at')
    setRows(data || [])
    setLoading(false)
  }, [nutricionistaId, demoMode])

  useEffect(() => { load() }, [load])

  const openNew = () => setEditor({ mode: 'new', emoji: '🍽️', label: '', tipsText: '' })
  const openEdit = (r: EatingOutGuideRow) => setEditor({ mode: 'edit', id: r.id, emoji: r.emoji, label: r.label, tipsText: tipsToText(r.tips) })
  const closeEditor = () => setEditor(null)

  const save = async () => {
    if (!editor) return
    if (!editor.label.trim()) { toast('Ponle un nombre (ej. "Italiano")', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); closeEditor(); return }
    const payload = { emoji: editor.emoji.trim() || '🍽️', label: editor.label.trim(), tips: textToTips(editor.tipsText) }
    if (editor.mode === 'new') {
      const { error } = await supabase.from('eating_out_guides').insert({ id: newId(), nutricionista_id: nutricionistaId, sort_order: rows.length, ...payload })
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast(`"${payload.label}" creada ✓`, 'ok')
    } else {
      const { error } = await supabase.from('eating_out_guides').update(payload).eq('id', editor.id)
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast('Guardada ✓', 'ok')
    }
    closeEditor()
    await load()
  }

  const deleteRow = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setRows(prev => prev.filter(r => r.id !== id))
    await supabase.from('eating_out_guides').delete().eq('id', id)
    toast('Eliminada', 'ok')
  }

  const restoreDefaults = async () => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    const { error } = await supabase.from('eating_out_guides').insert(
      DEFAULT_EATING_OUT_GUIDES.map((g, i) => ({ id: newId(), nutricionista_id: nutricionistaId, emoji: g.emoji, label: g.label, tips: g.tips, sort_order: i }))
    )
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast('Plantillas por defecto cargadas — ya puedes editarlas ✓', 'ok')
    await load()
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-1.5"><UtensilsCrossed className="w-4 h-4" /> Modo "Comer fuera" ({rows.length})</h2>
        {!editor && (
          <button onClick={openNew} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Nuevo tipo de restaurante
          </button>
        )}
      </div>
      <p className="text-xs text-muted mb-3">
        Pautas que ve tu cliente al pulsar "¿Vas a comer fuera?" en su Dieta, por tipo de restaurante. Si no creas
        ninguna aquí, ve un contenido genérico por defecto — en cuanto añadas la primera, se usan las tuyas en su lugar.
      </p>

      {editor && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <input value={editor.emoji} onChange={e => setEditor({ ...editor, emoji: e.target.value })} maxLength={4}
              placeholder="🍽️" className="w-14 px-2 py-2 bg-bg border border-border rounded-lg text-lg text-center outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={editor.label} onChange={e => setEditor({ ...editor, label: e.target.value })}
              placeholder="Tipo de restaurante (ej. Italiano)" autoFocus
              className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
            <button onClick={closeEditor} className="p-2 text-muted hover:text-warn"><X className="w-4 h-4" /></button>
          </div>
          <textarea value={editor.tipsText} onChange={e => setEditor({ ...editor, tipsText: e.target.value })}
            placeholder={'Una pauta por línea, ej.:\nPrioriza pasta con tomate o marisco antes que salsas cremosas.\nSi hay pizza, mejor base fina y sin exceso de queso.'}
            rows={5} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none resize-y focus:ring-2 focus:ring-accent/20" />
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={save}>Guardar</Button>
            <Button size="sm" variant="ghost" onClick={closeEditor}>Cancelar</Button>
          </div>
        </div>
      )}

      {rows.length === 0 && !editor ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <p className="text-muted text-sm">Todavía no has personalizado esto — tu cliente ve un contenido genérico por defecto.</p>
          <Button size="sm" variant="ghost" onClick={restoreDefaults}>
            <RotateCcw className="w-3.5 h-3.5" /> Empezar a partir de las plantillas por defecto
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} onClick={() => openEdit(r)}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-accent/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">{r.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.label}</p>
                  <p className="text-xs text-muted mt-0.5">{(Array.isArray(r.tips) ? r.tips.length : 0)} pauta{(Array.isArray(r.tips) && r.tips.length === 1) ? '' : 's'}</p>
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteRow(r.id) }} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
