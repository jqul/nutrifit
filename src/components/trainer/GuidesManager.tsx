import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { GuideRow } from '../../lib/supabase-types'
import { DEMO_GUIDES } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { Button } from '../shared/Button'
import { BookOpen, Plus, Trash2, X } from 'lucide-react'

function newId() { return crypto.randomUUID() }

interface GuideEditorState { mode: 'new' | 'edit'; id?: string; title: string; emoji: string; body: string }

/**
 * Biblioteca de guías del nutricionista — contenido fijo que ve TODO su
 * cliente (no hay asignación por cliente, ver migración 0039_guides.sql):
 * "Guía visual de raciones", "Cómo elegir un buen pan"... Mismo patrón de
 * editor inline que las plantillas/recetario en PlantillasTab.tsx.
 */
export function GuidesManager({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const [guides, setGuides] = useState<GuideRow[]>(demoMode ? DEMO_GUIDES : [])
  const [loading, setLoading] = useState(!demoMode)
  const [editor, setEditor] = useState<GuideEditorState | null>(null)

  const load = useCallback(async () => {
    if (demoMode) { setGuides(DEMO_GUIDES); return }
    setLoading(true)
    const { data } = await supabase.from('guides').select('*').eq('nutricionista_id', nutricionistaId).order('sort_order').order('created_at')
    setGuides(data || [])
    setLoading(false)
  }, [nutricionistaId, demoMode])

  useEffect(() => { load() }, [load])

  const openNew = () => setEditor({ mode: 'new', title: '', emoji: '📄', body: '' })
  const openEdit = (g: GuideRow) => setEditor({ mode: 'edit', id: g.id, title: g.title, emoji: g.emoji, body: g.body })
  const closeEditor = () => setEditor(null)

  const save = async () => {
    if (!editor) return
    if (!editor.title.trim()) { toast('Ponle un título a la guía', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); closeEditor(); return }
    const payload = { title: editor.title.trim(), emoji: editor.emoji.trim() || '📄', body: editor.body }
    if (editor.mode === 'new') {
      const { error } = await supabase.from('guides').insert({
        id: newId(), nutricionista_id: nutricionistaId, sort_order: guides.length, ...payload,
      })
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast(`Guía "${payload.title}" creada ✓`, 'ok')
    } else {
      const { error } = await supabase.from('guides').update(payload).eq('id', editor.id)
      if (error) { toast('Error: ' + error.message, 'warn'); return }
      toast('Guía actualizada ✓', 'ok')
    }
    closeEditor()
    await load()
  }

  const deleteGuide = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setGuides(prev => prev.filter(g => g.id !== id))
    await supabase.from('guides').delete().eq('id', id)
    toast('Guía eliminada', 'ok')
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Biblioteca de guías ({guides.length})</h2>
        {!editor && (
          <button onClick={openNew} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Nueva guía
          </button>
        )}
      </div>
      <p className="text-xs text-muted mb-3">
        Las ve <strong>todo</strong> tu cliente en su app ("Más" → Guías) — no es contenido por cliente, es tu biblioteca
        de recursos: raciones, cómo leer etiquetas, batch cooking, comer fuera de casa...
      </p>

      {editor && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <input value={editor.emoji} onChange={e => setEditor({ ...editor, emoji: e.target.value })} maxLength={4}
              placeholder="📄" className="w-14 px-2 py-2 bg-bg border border-border rounded-lg text-lg text-center outline-none focus:ring-2 focus:ring-accent/20" />
            <input value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })}
              placeholder="Título de la guía" autoFocus
              className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
            <button onClick={closeEditor} className="p-2 text-muted hover:text-warn"><X className="w-4 h-4" /></button>
          </div>
          <textarea value={editor.body} onChange={e => setEditor({ ...editor, body: e.target.value })}
            placeholder="Escribe la guía — se muestra tal cual, con tus saltos de línea" rows={6}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none resize-y focus:ring-2 focus:ring-accent/20" />
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={save}>Guardar guía</Button>
            <Button size="sm" variant="ghost" onClick={closeEditor}>Cancelar</Button>
          </div>
        </div>
      )}

      {guides.length === 0 && !editor ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-muted text-sm">Todavía no tienes ninguna. Pulsa "Nueva guía" para crear la primera.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {guides.map(g => (
            <div key={g.id} onClick={() => openEdit(g)}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-accent/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">{g.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{g.title}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">{g.body || 'Sin contenido todavía'}</p>
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteGuide(g.id) }} className="p-2 text-muted hover:text-warn flex-shrink-0" title="Eliminar guía">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
