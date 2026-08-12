import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { CustomSurveyRow, SurveyResponseRow } from '../../../lib/supabase-types'
import { supabase } from '../../../lib/supabase'
import { periodLabel } from '../../../lib/surveyPeriod'
import { ClipboardEdit } from 'lucide-react'

export function SurveyHistory({ client, demoMode, demoSurveys, demoResponses }: {
  client: ClientData
  demoMode?: boolean
  demoSurveys?: CustomSurveyRow[]
  demoResponses?: SurveyResponseRow[]
}) {
  const [surveys, setSurveys] = useState<CustomSurveyRow[]>(demoSurveys || [])
  const [responses, setResponses] = useState<SurveyResponseRow[]>(demoResponses || [])
  const [loading, setLoading] = useState(!demoMode)

  const load = useCallback(async () => {
    if (demoMode) return
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('custom_surveys').select('*').eq('nutricionista_id', client.nutricionistaId),
      supabase.from('survey_responses').select('*').eq('client_id', client.id).order('submitted_at', { ascending: false }),
    ])
    setSurveys(s || [])
    setResponses(r || [])
    setLoading(false)
  }, [client.nutricionistaId, client.id, demoMode])

  useEffect(() => { load() }, [load])

  if (loading || surveys.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="font-semibold text-sm mb-3 flex items-center gap-1.5"><ClipboardEdit className="w-4 h-4" /> Encuestas recurrentes</p>
      <div className="space-y-4">
        {surveys.map(s => {
          const surveyResponses = responses
            .filter(r => r.survey_id === s.id)
            .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
          return (
            <div key={s.id}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                {s.name} {!s.active && '· inactiva'}
              </p>
              {surveyResponses.length === 0 ? (
                <p className="text-sm text-muted">El cliente todavía no ha respondido.</p>
              ) : (
                <div className="space-y-3">
                  {surveyResponses.map(r => (
                    <div key={r.id} className="border border-border rounded-xl p-3">
                      <p className="text-xs text-muted mb-2">{periodLabel(s.frequency, r.period_key)}</p>
                      <div className="space-y-1.5">
                        {s.questions.map(q => r.answers[q.id] ? (
                          <div key={q.id}>
                            <p className="text-xs text-muted">{q.label}</p>
                            <p className="text-sm">{r.answers[q.id]}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
