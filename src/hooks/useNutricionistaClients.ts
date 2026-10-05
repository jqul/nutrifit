import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ClientData, DailyCheckin, WeightEntry } from '../types'
import { clientFromRow, clientToRow, checkinFromRow, weightFromRow } from '../lib/mappers'
import { summarizeWeight } from '../lib/clientListSummary'
import { calcAdherence, calcStreak } from '../lib/adherence'
import { computeClientAlerts, ClientAlert } from '../lib/clientAlerts'
import { computeClientHealth, hasUnreviewedActivity, ClientHealthStatus, ClientHealthReason } from '../lib/clientHealth'
import { hasAnyMarkerOutOfRange } from '../lib/bloodMarkers'
import { toast } from '../components/shared/Toast'
import { DEMO_CHECKINS, DEMO_INVOICES, DEMO_BLOOD_MARKERS, DEMO_SURVEY_RESPONSES, DEMO_WEIGHTS } from '../lib/demo-data'
import { InvoiceRow, BloodMarkerRow, SurveyResponseRow } from '../lib/supabase-types'
import { generateClientToken } from '../lib/token'
import { fetchAllRows, fetchAllRowsForIds } from '../lib/fetchAll'
import { ActivitySummary, HISTORY_WINDOW_DAYS, latestDate, weightsWithBounds } from '../lib/activitySummary'

export interface ClientWithStats extends ClientData {
  lastCheckin?: string
  doneToday?: boolean
  adherence7d?: number
  streak?: number
  healthStatus?: ClientHealthStatus
  healthLabel?: string
  healthReason?: ClientHealthReason
  /** Avisos del Centro de control (peso estancado, hambre alta...) — ver clientAlerts.ts. */
  alerts?: ClientAlert[]
  /** Último check-in o pesaje (YYYY-MM-DD): base de la retención por actividad (retention.ts). */
  lastActivity?: string
  /** Adherencia de la semana anterior a las últimas 7 días, para detectar caídas. */
  adherencePrev7d?: number
  /** Primer peso registrado, para medir el cambio total. */
  weightStartKg?: number
  /** Último peso registrado y su variación en 4 semanas (null si hay <2 pesajes). */
  weightKg?: number
  weightDeltaKg?: number | null
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

interface Options {
  nutricionistaId: string
  demoClients?: ClientData[]
}

export function withStats(
  clients: ClientData[], checkinsMap: Record<string, DailyCheckin[]>, invoicesMap: Record<string, InvoiceRow[]> = {},
  bloodMarkersMap: Record<string, BloodMarkerRow[]> = {}, surveyResponsesMap: Record<string, SurveyResponseRow[]> = {},
  weightsMap: Record<string, WeightEntry[]> = {},
  // Último check-in y primer/último pesaje de cada cliente (clients_activity_summary). La app solo
  // descarga los últimos días de historial; esto cubre lo que queda fuera de esa ventana.
  activityMap: Record<string, ActivitySummary> = {},
): ClientWithStats[] {
  const today = new Date()
  const todayStr = toLocalISODate(today)
  const period = currentPeriod()
  return clients.map(c => {
    const checkins = checkinsMap[c.id] || []
    const sorted = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
    const activity = activityMap[c.id]
    const lastCheckin = latestDate(sorted[0]?.date, activity?.last_checkin)
    const streak = calcStreak(checkins, today)
    const hasCurrentPeriodInvoice = (invoicesMap[c.id] || []).some(i => i.period === period)
    const hasBiomarkerAlert = hasAnyMarkerOutOfRange(bloodMarkersMap[c.id] || [])
    const lastSurveySubmittedAt = [...(surveyResponsesMap[c.id] || [])].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0]?.submitted_at
    const unreviewed = hasUnreviewedActivity(c.lastReviewedAt, lastCheckin, lastSurveySubmittedAt)
    const health = computeClientHealth({
      lastCheckin, streak, createdAt: c.createdAt, monthlyPrice: c.monthlyPrice,
      hasBiomarkerAlert, hasUnreviewedActivity: unreviewed,
    }, hasCurrentPeriodInvoice, today)
    // Los pesajes recientes + el primero y el último de la historia, aunque queden fuera de la ventana.
    const weights = weightsWithBounds(c.id, weightsMap[c.id] || [], activity)
    const weight = summarizeWeight(weights, today)
    const firstWeigh = weights[0]
    const lastWeigh = weights[weights.length - 1]?.date
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    return {
      ...c,
      lastActivity: latestDate(lastCheckin, lastWeigh),
      adherencePrev7d: calcAdherence(checkins, 7, weekAgo),
      weightStartKg: firstWeigh?.weightKg,
      weightKg: weight?.latestKg,
      weightDeltaKg: weight?.deltaKg ?? null,
      lastCheckin,
      doneToday: lastCheckin === todayStr,
      adherence7d: calcAdherence(checkins, 7, today),
      streak,
      healthStatus: health.status,
      healthLabel: health.label,
      healthReason: health.reason,
      alerts: computeClientAlerts({
        checkins, weights, goal: c.goal, goalWeightKg: c.goalWeightKg, createdAt: c.createdAt,
      }, today),
    }
  })
}

/** El mensaje que devolvió una función de Supabase cuando falla (viene en el cuerpo de la respuesta). */
async function functionErrorDetail(error: unknown): Promise<string> {
  try {
    const res = (error as { context?: Response } | null)?.context
    const body = res ? await res.json() : null
    return typeof body?.error === 'string' ? body.error : ''
  } catch { return '' }
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface NewClientInput {
  name: string
  surname: string
  phone: string
  email: string
  goal: string
  heightCm: string
  gender: string
  birthDate: string
  allergies: string
}

export function useNutricionistaClients({ nutricionistaId, demoClients }: Options) {
  const [clients, setClients] = useState<ClientWithStats[]>(
    demoClients ? withStats(demoClients, DEMO_CHECKINS, DEMO_INVOICES, DEMO_BLOOD_MARKERS, DEMO_SURVEY_RESPONSES, DEMO_WEIGHTS) : []
  )
  const [loading, setLoading] = useState(!demoClients)

  const fetchClients = useCallback(async () => {
    if (demoClients) return
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').eq('nutricionista_id', nutricionistaId)
    if (error) { console.error(error); toast('No se pudieron cargar los clientes', 'warn'); setLoading(false); return }
    const mapped = (data || []).map(clientFromRow)

    if (mapped.length) {
      const ids = mapped.map(c => c.id)
      // PostgREST corta cada respuesta en 1.000 filas SIN avisar: traer "todos los check-ins" de varios
      // clientes se pasa enseguida. Por eso todo va paginado (con orden estable) y los check-ins y pesajes
      // solo de los últimos días; lo que queda fuera de esa ventana (último check-in, primer peso...) llega
      // por clients_activity_summary, una fila por cliente.
      const since = new Date(); since.setDate(since.getDate() - HISTORY_WINDOW_DAYS)
      const sinceStr = toLocalISODate(since)
      let checkinRows, invoiceRows, bloodMarkerRows, surveyResponseRows, weightRows, activityRows
      try {
        ;[checkinRows, invoiceRows, bloodMarkerRows, surveyResponseRows, weightRows, activityRows] = await Promise.all([
          fetchAllRowsForIds(ids, (chunk, from, to) => supabase.from('daily_checkins').select('*').in('client_id', chunk).gte('date', sinceStr).order('date').order('id').range(from, to)),
          fetchAllRowsForIds(ids, (chunk, from, to) => supabase.from('invoices').select('*').in('client_id', chunk).order('period').order('id').range(from, to)),
          fetchAllRowsForIds(ids, (chunk, from, to) => supabase.from('blood_markers').select('*').in('client_id', chunk).order('date').order('id').range(from, to)),
          fetchAllRowsForIds(ids, (chunk, from, to) => supabase.from('survey_responses').select('*').in('client_id', chunk).order('submitted_at').order('id').range(from, to)),
          fetchAllRowsForIds(ids, (chunk, from, to) => supabase.from('weight_logs').select('*').in('client_id', chunk).gte('date', sinceStr).order('date').order('id').range(from, to)),
          fetchAllRows<ActivitySummary>((from, to) => supabase.rpc('clients_activity_summary', { p_client_ids: ids }).range(from, to)),
        ])
      } catch (e) {
        // Antes un fallo aquí se ignoraba y la lista salía con datos a medias; mejor decirlo.
        console.error(e)
        toast('No se pudieron cargar todos los datos de los clientes', 'warn')
        setLoading(false)
        return
      }
      const checkinsByClient: Record<string, DailyCheckin[]> = {}
      checkinRows.forEach((row) => {
        const c = checkinFromRow(row)
        ;(checkinsByClient[c.clientId] ||= []).push(c)
      })
      const invoicesByClient: Record<string, InvoiceRow[]> = {}
      invoiceRows.forEach((row: InvoiceRow) => { (invoicesByClient[row.client_id] ||= []).push(row) })
      const bloodMarkersByClient: Record<string, BloodMarkerRow[]> = {}
      bloodMarkerRows.forEach((row: BloodMarkerRow) => { (bloodMarkersByClient[row.client_id] ||= []).push(row) })
      const surveyResponsesByClient: Record<string, SurveyResponseRow[]> = {}
      surveyResponseRows.forEach((row: SurveyResponseRow) => { (surveyResponsesByClient[row.client_id] ||= []).push(row) })
      const weightsByClient: Record<string, WeightEntry[]> = {}
      weightRows.forEach((row) => {
        const w = weightFromRow(row)
        ;(weightsByClient[w.clientId] ||= []).push(w)
      })
      const activityByClient: Record<string, ActivitySummary> = {}
      activityRows.forEach(r => { activityByClient[r.client_id] = r })
      setClients(withStats(mapped, checkinsByClient, invoicesByClient, bloodMarkersByClient, surveyResponsesByClient, weightsByClient, activityByClient))
    } else {
      setClients([])
    }
    setLoading(false)
  }, [nutricionistaId])

  useEffect(() => {
    if (demoClients) return
    fetchClients()
    const channel = supabase.channel('clientes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes', filter: `nutricionista_id=eq.${nutricionistaId}` }, fetchClients)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [nutricionistaId, demoClients, fetchClients])

  const addClient = async (newClient: NewClientInput) => {
    const token = generateClientToken()
    if (demoClients) {
      const demoClient: ClientData = {
        id: `demo-new-${Date.now()}`, nutricionistaId, token,
        authUserId: null, name: newClient.name.trim(), surname: newClient.surname.trim(),
        phone: newClient.phone.trim(), email: newClient.email.trim(),
        goal: newClient.goal.trim() || null, heightCm: newClient.heightCm ? parseFloat(newClient.heightCm) : null,
        gender: newClient.gender || null, birthDate: newClient.birthDate || null,
        allergies: newClient.allergies.trim(), notes: '', reportNotes: '', consentAcceptedAt: null, consentSignedName: null,
        monthlyPrice: null, goalWeightKg: null, customMessages: {}, tags: [],
        createdAt: Date.now(), lastReviewedAt: null,
      }
      setClients(prev => [...prev, ...withStats([demoClient], {})])
      toast('Cliente añadido (modo demo — no se guarda)', 'ok')
      return true
    }
    const { error } = await supabase.from('clientes').insert({
      nutricionista_id: nutricionistaId,
      token,
      name: newClient.name.trim(),
      surname: newClient.surname.trim(),
      phone: newClient.phone.trim(),
      email: newClient.email.trim() || null,
      goal: newClient.goal.trim() || null,
      height_cm: newClient.heightCm ? parseFloat(newClient.heightCm) : null,
      gender: newClient.gender || null,
      birth_date: newClient.birthDate || null,
      allergies: newClient.allergies.trim(),
      notes: '',
      created_at: new Date().toISOString(),
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return false }
    toast('Cliente creado ✓', 'ok')
    await fetchClients()
    return true
  }

  const updateClient = async (id: string, updates: Partial<ClientData>) => {
    if (demoClients) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
      toast('Cambios aplicados (modo demo — no se guardan)', 'ok')
      return true
    }
    const row = clientToRow(updates)
    const { error } = await supabase.from('clientes').update(row).eq('id', id)
    if (error) { toast('Error: ' + error.message, 'warn'); return false }
    await fetchClients()
    return true
  }

  const deleteClient = async (id: string) => {
    if (demoClients) {
      setClients(prev => prev.filter(c => c.id !== id))
      toast('Cliente eliminado (modo demo — no se guarda)', 'ok')
      return true
    }
    // La eliminación completa la hace la función delete-client: además de la ficha (y sus 18 tablas)
    // borra los ficheros del cliente (fotos, analíticas en PDF) y su cuenta de acceso, que borrar la
    // fila sola no toca.
    const { data, error } = await supabase.functions.invoke('delete-client', { body: { clientId: id } })
    if (error || !data?.ok) {
      const detail = await functionErrorDetail(error)
      toast(`No se pudo eliminar al cliente${detail ? `: ${detail}` : ''}`, 'warn')
      return false
    }
    await fetchClients()
    if (data.accountError) toast(`Cliente eliminado, pero no se pudo borrar su cuenta de acceso: ${data.accountError}`, 'warn')
    else toast('Cliente eliminado, con sus ficheros y su cuenta de acceso', 'ok')
    return true
  }

  const regenerateToken = async (id: string) => {
    const token = generateClientToken()
    if (demoClients) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, token } : c))
      toast('Enlace regenerado (modo demo — no se guarda)', 'ok')
      return token
    }
    const { error } = await supabase.from('clientes').update({ token }).eq('id', id)
    if (error) { toast('Error al regenerar el enlace', 'warn'); return null }
    await fetchClients()
    toast('Enlace regenerado — el anterior ha dejado de funcionar', 'ok')
    return token
  }

  // Marca la ficha como revisada ahora mismo — se llama sola al abrir
  // Seguimiento (ver ClientPanel.tsx), sin toast ni confirmación, para que
  // el aviso de "check-in o encuesta sin revisar" desaparezca en cuanto el
  // nutricionista de verdad la mira. Actualiza el estado local al momento
  // (no espera a un refetch) para que el badge se quite sin parpadeos.
  const markClientReviewed = async (id: string) => {
    const now = new Date().toISOString()
    setClients(prev => prev.map(c => c.id === id ? { ...c, lastReviewedAt: now } : c))
    if (demoClients) return
    await supabase.from('clientes').update({ last_reviewed_at: now }).eq('id', id)
  }

  return { clients, loading, fetchClients, addClient, updateClient, deleteClient, regenerateToken, markClientReviewed }
}
