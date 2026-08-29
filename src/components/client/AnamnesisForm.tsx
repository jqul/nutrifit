import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ANAMNESIS_QUESTIONS } from '../../lib/anamnesis'
import { CustomAnamnesisQuestion } from '../../types'
import { DEMO_ANAMNESIS, DEMO_NUTRICIONISTA_PROFILE } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { QuestionInput } from '../shared/QuestionInput'
import { ClipboardList, Check } from 'lucide-react'

export function AnamnesisForm({ clientId, nutricionistaId, demoMode, personalMode, openByDefault }: {
  clientId: string; nutricionistaId: string; demoMode?: boolean
  // true en modo personal (ver PersonalModeShell) — cambia el texto de
  // presentación, que en tercera persona ("tu nutricionista") suena raro
  // siendo la misma persona.
  personalMode?: boolean
  openByDefault?: boolean
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(demoMode ? (DEMO_ANAMNESIS[clientId] || {}) : {})
  const [completedAt, setCompletedAt] = useState<string | null>(demoMode && DEMO_ANAMNESIS[clientId] ? new Date().toISOString() : null)
  const [customQuestions, setCustomQuestions] = useState<CustomAnamnesisQuestion[]>(demoMode ? DEMO_NUTRICIONISTA_PROFILE.customAnamnesisQuestions : [])
  const [open, setOpen] = useState(!!openByDefault)
  const [loading, setLoading] = useState(!demoMode)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const [{ data }, { data: nutri }] = await Promise.all([
      supabase.from('anamnesis').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('nutricionistas').select('custom_anamnesis_questions').eq('uid', nutricionistaId).maybeSingle(),
    ])
    if (data) { setAnswers(data.answers || {}); setCompletedAt(data.completed_at) }
    setCustomQuestions(nutri?.custom_anamnesis_questions || [])
    setLoading(false)
  }, [clientId, nutricionistaId, demoMode])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    const missing = customQuestions.find(q => q.required && !answers[q.id]?.trim())
    if (missing) { toast(`Falta responder: "${missing.label}"`, 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setOpen(false); return }
    setSaving(true)
    const { error } = await supabase.from('anamnesis').upsert({
      client_id: clientId, answers, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    setSaving(false)
    if (error) { toast('Error al guardar', 'warn'); return }
    setCompletedAt(new Date().toISOString())
    toast('Cuestionario guardado ✓', 'ok')
    setOpen(false)
  }

  if (loading) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> Cuestionario de salud</p>
          <p className="text-xs text-muted mt-0.5">
            {completedAt
              ? `Completado el ${new Date(completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : personalMode ? 'Te ayuda a tener claro tu punto de partida.' : 'Ayuda a tu nutricionista a conocerte mejor antes de la primera consulta.'}
          </p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-xs font-bold text-accent">
          {completedAt ? 'Editar' : 'Rellenar'}
        </button>
      </div>

      {open && (
        <div className="space-y-3 pt-2 border-t border-border">
          {ANAMNESIS_QUESTIONS.map(q => (
            <div key={q.key}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{q.label}</label>
              {q.type === 'select' ? (
                <select value={answers[q.key] || ''} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
                  <option value="">Selecciona...</option>
                  {q.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : q.type === 'textarea' ? (
                <textarea value={answers[q.key] || ''} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
              ) : (
                <input type={q.type === 'number' ? 'number' : 'text'} value={answers[q.key] || ''} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
              )}
            </div>
          ))}
          {customQuestions.length > 0 && (
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Preguntas de tu nutricionista</p>
              {customQuestions.map(q => (
                <div key={q.id}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    {q.label}{q.required && <span className="text-warn"> *</span>}
                  </label>
                  <QuestionInput question={q} value={answers[q.id] || ''} onChange={v => setAnswers({ ...answers, [q.id]: v })} />
                </div>
              ))}
            </div>
          )}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar respuestas'}
          </button>
        </div>
      )}
    </div>
  )
}
