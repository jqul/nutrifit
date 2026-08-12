import { useState, useEffect, useCallback } from 'react'
import { CustomAnamnesisQuestion, SurveyFrequency } from '../../types'
import { CustomSurveyRow } from '../../lib/supabase-types'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/usePushNotifications'
import { toast } from '../shared/Toast'
import { Button } from '../shared/Button'
import { Plus, Trash2, ClipboardEdit, Power } from 'lucide-react'

function newId() { return crypto.randomUUID() }

const FREQUENCY_LABELS: Record<SurveyFrequency, string> = { weekly: 'Semanal', monthly: 'Mensual' }

export function SurveyManager({ nutricionistaId, demoMode, demoSurveys }: {
  nutricionistaId: string
  demoMode?: boolean
  demoSurveys?: CustomSurveyRow[]
}) {
  const [surveys, setSurveys] = useState<CustomSurveyRow[]>(demoSurveys || [])
  const [loading, setLoading] = useState(!demoSurveys)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<SurveyFrequency>('weekly')
  const [questions, setQuestions] = useState<CustomAnamnesisQuestion[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoSurveys) return
    const { data } = await supabase.from('custom_surveys').select('*').eq('nutricionista_id', nutricionistaId).order('created_at')
    setSurveys(data || [])
    setLoading(false)
  }, [nutricionistaId, demoSurveys])

  useEffect(() => { load() }, [load])

  const addQuestion = () => {
    if (!newQuestion.trim()) return
    setQuestions([...questions, { id: newId(), label: newQuestion.trim() }])
    setNewQuestion('')
  }

  const resetForm = () => { setName(''); setFrequency('weekly'); setQuestions([]); setNewQuestion(''); setCreating(false) }

  const handleCreate = async () => {
    if (!name.trim()) { toast('Ponle un nombre a la encuesta', 'warn'); return }
    if (questions.length === 0) { toast('Añade al menos una pregunta', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); resetForm(); return }
    setSaving(true)
    const { error } = await supabase.from('custom_surveys').insert({
      nutricionista_id: nutricionistaId, name: name.trim(), frequency, questions, active: true,
    })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`Encuesta "${name.trim()}" creada ✓ — se avisará a tus clientes`, 'ok')
    resetForm()
    await load()
    // Aviso inmediato a los clientes ya existentes (además del recordatorio
    // automático cuando les toque el siguiente periodo).
    const { data: clients } = await supabase.from('clientes').select('id').eq('nutricionista_id', nutricionistaId)
    ;(clients || []).forEach(c => {
      sendPush({ clientId: c.id }, 'Nueva encuesta 📋', `Tu nutricionista ha añadido "${name.trim()}"`)
    })
  }

  const toggleActive = async (survey: CustomSurveyRow) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, active: !s.active } : s))
    await supabase.from('custom_surveys').update({ active: !survey.active }).eq('id', survey.id)
  }

  const deleteSurvey = async (survey: CustomSurveyRow) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    if (!confirm(`¿Eliminar "${survey.name}"? También se borrará el historial de respuestas.`)) return
    setSurveys(prev => prev.filter(s => s.id !== survey.id))
    await supabase.from('custom_surveys').delete().eq('id', survey.id)
  }

  if (loading) return <p className="text-sm text-muted">Cargando...</p>

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm flex items-center gap-1.5"><ClipboardEdit className="w-4 h-4" /> Encuestas recurrentes</p>
        {!creating && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Nueva encuesta
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Crea encuestas con tus propias preguntas para que tus clientes las rellenen cada semana o cada mes.
        Se avisa al cliente (panel + notificación push) cuando le toca la siguiente.
      </p>

      {surveys.length > 0 && (
        <div className="space-y-2">
          {surveys.map(s => (
            <div key={s.id} className="border border-border rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {FREQUENCY_LABELS[s.frequency]} · {s.questions.length} pregunta{s.questions.length === 1 ? '' : 's'}
                    {!s.active && ' · inactiva'}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(s)} title={s.active ? 'Desactivar' : 'Activar'}
                    className={`p-1.5 rounded-lg ${s.active ? 'text-ok hover:bg-ok/10' : 'text-muted hover:bg-bg-alt'}`}>
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteSurvey(s)} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Seguimiento semanal"
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Frecuencia</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as SurveyFrequency)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>
          {questions.length > 0 && (
            <div className="space-y-2">
              {questions.map(q => (
                <div key={q.id} className="flex items-center gap-2 bg-bg-alt rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm">{q.label}</span>
                  <button onClick={() => setQuestions(questions.filter(x => x.id !== q.id))} className="text-muted hover:text-warn flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuestion()}
              placeholder="Ej. ¿Cómo ha ido tu adherencia esta semana?"
              className="flex-1 px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
            <button onClick={addQuestion} className="p-2.5 bg-bg-alt rounded-xl text-muted hover:text-accent flex-shrink-0"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} loading={saving}>Crear encuesta</Button>
            <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
