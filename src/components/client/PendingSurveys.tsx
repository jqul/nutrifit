import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../types'
import { CustomSurveyRow, SurveyResponseRow } from '../../lib/supabase-types'
import { supabase } from '../../lib/supabase'
import { periodKeyFor } from '../../lib/surveyPeriod'
import { DEMO_CUSTOM_SURVEYS, DEMO_SURVEY_RESPONSES } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { QuestionInput } from '../shared/QuestionInput'
import { ClipboardEdit, Check } from 'lucide-react'

const FREQUENCY_LABELS: Record<'weekly' | 'monthly', string> = { weekly: 'esta semana', monthly: 'este mes' }

export function PendingSurveys({ client, demoMode }: { client: ClientData; demoMode?: boolean }) {
  const [surveys, setSurveys] = useState<CustomSurveyRow[]>(demoMode ? DEMO_CUSTOM_SURVEYS : [])
  const [responses, setResponses] = useState<SurveyResponseRow[]>(demoMode ? (DEMO_SURVEY_RESPONSES[client.id] || []) : [])
  const [loading, setLoading] = useState(!demoMode)
  const [openSurvey, setOpenSurvey] = useState<string | null>(null)
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('custom_surveys').select('*').eq('nutricionista_id', client.nutricionistaId).eq('active', true),
      supabase.from('survey_responses').select('*').eq('client_id', client.id),
    ])
    setSurveys(s || [])
    setResponses(r || [])
    setLoading(false)
  }, [client.nutricionistaId, client.id, demoMode])

  useEffect(() => { load() }, [load])

  if (loading) return null

  const pending = surveys
    .map(s => ({ survey: s, periodKey: periodKeyFor(s.frequency) }))
    .filter(({ survey, periodKey }) => !responses.some(r => r.survey_id === survey.id && r.period_key === periodKey))

  if (pending.length === 0) return null

  const handleSave = async (surveyId: string, periodKey: string) => {
    const survey = surveys.find(s => s.id === surveyId)
    const missing = survey?.questions.find(q => q.required && !draftAnswers[q.id]?.trim())
    if (missing) { toast(`Falta responder: "${missing.label}"`, 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setOpenSurvey(null); setDraftAnswers({}); return }
    setSaving(true)
    const { error } = await supabase.from('survey_responses').upsert({
      survey_id: surveyId, client_id: client.id, period_key: periodKey, answers: draftAnswers,
    }, { onConflict: 'survey_id,client_id,period_key' })
    setSaving(false)
    if (error) { toast('Error al guardar', 'warn'); return }
    toast('Encuesta enviada ✓', 'ok')
    setOpenSurvey(null)
    setDraftAnswers({})
    await load()
  }

  return (
    <div className="space-y-3">
      {pending.map(({ survey, periodKey }) => (
        <div key={survey.id} className="bg-card border border-accent/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5"><ClipboardEdit className="w-4 h-4 text-accent" /> {survey.name}</p>
              <p className="text-xs text-muted mt-0.5">Pendiente de {FREQUENCY_LABELS[survey.frequency]}</p>
            </div>
            {openSurvey !== survey.id && (
              <button onClick={() => { setOpenSurvey(survey.id); setDraftAnswers({}) }} className="flex-shrink-0 text-xs font-bold text-accent">
                Rellenar
              </button>
            )}
          </div>
          {openSurvey === survey.id && (
            <div className="space-y-3 pt-2 border-t border-border">
              {survey.questions.map(q => (
                <div key={q.id}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    {q.label}{q.required && <span className="text-warn"> *</span>}
                  </label>
                  <QuestionInput question={q} value={draftAnswers[q.id] || ''} onChange={v => setDraftAnswers({ ...draftAnswers, [q.id]: v })} />
                </div>
              ))}
              <button onClick={() => handleSave(survey.id, periodKey)} disabled={saving}
                className="w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> {saving ? 'Enviando...' : 'Enviar respuestas'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
