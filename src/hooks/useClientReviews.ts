import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ClientReviewRow } from '../lib/supabase-types'
import { weekStartISO, WeeklyReview, ReviewStatus } from '../lib/weeklyReview'

// En demo no hay base de datos: las decisiones viven en memoria mientras dure la
// sesión, para que el Inicio y la ficha se vean coherentes entre sí.
const demoStore = new Map<string, ClientReviewRow>()
const demoKey = (clientId: string, weekStart: string) => `${clientId}:${weekStart}`

/** Revisiones de demo de un cliente (para el informe en modo demo). */
export const getDemoReviews = (clientId: string): ClientReviewRow[] => [...demoStore.values()].filter(r => r.client_id === clientId)

export interface SaveReviewInput {
  clientId: string
  review: WeeklyReview
  status: ReviewStatus
  /** Texto final del nutricionista (la sugerencia tal cual si la aceptó; vacío si la ignoró). */
  note: string
}

async function persistReview(input: SaveReviewInput, demoMode: boolean): Promise<ClientReviewRow | null> {
  const now = new Date().toISOString()
  const base = {
    client_id: input.clientId, week_start: input.review.weekStart, status: input.status,
    summary: input.review.items.map(i => ({ key: i.key, label: i.label, value: i.value, detail: i.detail, tone: i.tone })),
    suggestion: input.review.suggestion, note: input.note,
  }
  if (demoMode) {
    const row: ClientReviewRow = { id: `demo-review-${input.clientId}`, created_at: now, updated_at: now, ...base }
    demoStore.set(demoKey(input.clientId, input.review.weekStart), row)
    return row
  }
  const { data, error } = await supabase.from('client_reviews')
    .upsert({ ...base, updated_at: now }, { onConflict: 'client_id,week_start' }).select().single()
  if (error) return null
  return data as ClientReviewRow
}

/** La revisión de esta semana de un cliente (si el nutricionista ya decidió) y cómo guardarla. */
export function useClientReview(clientId: string, demoMode: boolean) {
  const weekStart = weekStartISO(new Date())
  const [review, setReview] = useState<ClientReviewRow | null>(demoMode ? demoStore.get(demoKey(clientId, weekStart)) ?? null : null)
  const [loading, setLoading] = useState(!demoMode)

  useEffect(() => {
    if (demoMode) { setReview(demoStore.get(demoKey(clientId, weekStart)) ?? null); return }
    let cancelled = false
    setLoading(true)
    supabase.from('client_reviews').select('*').eq('client_id', clientId).eq('week_start', weekStart).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setReview((data as ClientReviewRow | null) ?? null); setLoading(false) } })
    return () => { cancelled = true }
  }, [clientId, weekStart, demoMode])

  const save = useCallback(async (input: Omit<SaveReviewInput, 'clientId'>) => {
    const row = await persistReview({ ...input, clientId }, demoMode)
    if (row) setReview(row)
    return row !== null
  }, [clientId, demoMode])

  return { review, loading, save }
}

/** Ids de los clientes cuya revisión de esta semana ya está decidida (para el Centro de control). */
export function useReviewedThisWeek(demoMode: boolean): Set<string> {
  const weekStart = weekStartISO(new Date())
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (demoMode) {
      setIds(new Set([...demoStore.values()].filter(r => r.week_start === weekStart).map(r => r.client_id)))
      return
    }
    supabase.from('client_reviews').select('client_id').eq('week_start', weekStart)
      .then(({ data }) => setIds(new Set((data || []).map((r: { client_id: string }) => r.client_id))))
  }, [weekStart, demoMode])

  return ids
}
