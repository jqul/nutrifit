import { useMemo, useState } from 'react'
import { ClientData, DailyCheckin, WeightEntry } from '../../../types'
import { buildWeeklyReview, ReviewStatus, ReviewTone } from '../../../lib/weeklyReview'
import { useClientReview } from '../../../hooks/useClientReviews'
import { toast } from '../../shared/Toast'

const DOT: Record<ReviewTone, string> = { good: 'bg-ok', warn: 'bg-warn', neutral: 'bg-muted/50' }
const STATUS_TEXT: Record<ReviewStatus, string> = { accepted: 'Aceptada', edited: 'Aceptada con cambios', ignored: 'Ignorada' }

/**
 * Revisión semanal sugerida: los últimos 7 días frente a los 7 anteriores y una
 * sugerencia que el nutricionista acepta, edita o ignora. Es una ayuda para
 * decidir: nada cambia en el plan por aceptarla.
 */
export function WeeklyReviewCard({ client, checkins, weights, demoMode }: {
  client: ClientData; checkins: DailyCheckin[]; weights: WeightEntry[]; demoMode: boolean
}) {
  const { review: saved, loading, save } = useClientReview(client.id, demoMode)
  const review = useMemo(() => buildWeeklyReview({
    checkins, weights, goal: client.goal, goalWeightKg: client.goalWeightKg, createdAt: client.createdAt,
  }), [checkins, weights, client.goal, client.goalWeightKg, client.createdAt])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [reopened, setReopened] = useState(false)

  if (!review.hasData || loading) return null

  const decide = async (status: ReviewStatus, note: string) => {
    setSaving(true)
    const ok = await save({ review, status, note })
    setSaving(false)
    if (!ok) { toast('No se pudo guardar la revisión', 'warn'); return }
    setEditing(false); setReopened(false)
    toast(demoMode ? 'Modo demo: la revisión no se guarda de verdad' : status === 'ignored' ? 'Revisión ignorada' : 'Revisión guardada ✓', 'ok')
  }

  const done = saved && !reopened

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-sm">Revisión de la semana</p>
          <p className="text-xs text-muted">Últimos 7 días frente a los 7 anteriores</p>
        </div>
        {done && <span className="text-xs font-semibold text-ok">{STATUS_TEXT[saved.status]}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {review.items.map(i => (
          <div key={i.key} className="bg-bg-alt/60 rounded-xl p-3 min-w-0">
            <p className="text-xs text-muted flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT[i.tone]}`} /> {i.label}
            </p>
            <p className="font-serif font-bold text-lg leading-tight mt-1">{i.value}</p>
            {i.detail && <p className="text-xs text-muted">{i.detail}</p>}
          </div>
        ))}
      </div>

      {done ? (
        <div className="space-y-2">
          {saved.note && (
            <div className="bg-accent/10 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-accent mb-1">Tu valoración</p>
              <p className="text-sm leading-relaxed">{saved.note}</p>
            </div>
          )}
          <button onClick={() => { setReopened(true); setDraft(saved.note || review.suggestion) }}
            className="text-xs font-semibold text-muted hover:text-ink underline">Volver a revisar</button>
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <label htmlFor="review-note" className="block text-xs font-semibold text-muted">Tu valoración</label>
          <textarea id="review-note" value={draft} onChange={e => setDraft(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-border rounded-xl text-sm font-semibold text-muted hover:text-ink">Cancelar</button>
            <button disabled={saving || !draft.trim()} onClick={() => decide(draft.trim() === review.suggestion ? 'accepted' : 'edited', draft.trim())}
              className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-bold disabled:opacity-40">Guardar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-accent/10 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-accent mb-1">Sugerencia</p>
            <p className="text-sm leading-relaxed">{review.suggestion}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} onClick={() => decide('accepted', review.suggestion)}
              className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-bold disabled:opacity-40">Aceptar</button>
            <button disabled={saving} onClick={() => { setDraft(review.suggestion); setEditing(true) }}
              className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:border-accent hover:text-accent">Editar</button>
            <button disabled={saving} onClick={() => decide('ignored', '')}
              className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink">Ignorar</button>
          </div>
        </div>
      )}
    </div>
  )
}
