import { useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { appointmentFromRow, bodyMetricFromRow, metricDefinitionFromRow, planPhaseFromRow } from '../../../lib/mappers'
import {
  DEMO_APPOINTMENTS, DEMO_METRIC_DEFS, DEMO_PLAN_CHANGES, demoBodyMetrics, demoPlanPhases,
} from '../../../lib/demo-data'
import { ClientData, DailyCheckin, WeightEntry, ClinicalNote } from '../../../types'
import { BloodMarkerRow, DietPlanChangeRow } from '../../../lib/supabase-types'
import { MetricDefinition, MetricValue } from '../../../lib/bodyMetrics'
import { PlanPhase } from '../../../lib/planPhases'
import { computeClientAlerts } from '../../../lib/clientAlerts'
import { toLocalISODate } from '../../../lib/date'
import { buildConsultationBrief, describeMeasurement } from '../../../lib/consultationBrief'
import { briefDate, briefPeriodLabel, printConsultationBrief } from '../../../lib/printConsultationBrief'
import { formatWeightDelta } from '../../../lib/clientListSummary'
import { PrintBranding } from '../../../lib/printPlan'
import { Modal } from '../../shared/Modal'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'

const fmtKg = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

interface Extras {
  lastConsultationISO: string | null
  metricDefs: MetricDefinition[]; metricValues: MetricValue[]
  planChanges: DietPlanChangeRow[]; phases: PlanPhase[]
}

/**
 * «Preparar la consulta»: una página con lo que ha cambiado en el cliente desde la última consulta (peso, medidas, adherencia
 * mes a mes, señales, analíticas fuera de rango, plan, fase y notas) y una lista de cosas para hablar. Se puede imprimir.
 */
export function ConsultationBriefModal({ open, onClose, client, weights, checkins, bloodMarkers, clinicalNotes, branding, demoMode }: {
  open: boolean; onClose: () => void; client: ClientData
  weights: WeightEntry[]; checkins: DailyCheckin[]; bloodMarkers: BloodMarkerRow[]; clinicalNotes: ClinicalNote[]
  branding?: PrintBranding; demoMode?: boolean
}) {
  const [extras, setExtras] = useState<Extras | null>(null)
  const todayISO = toLocalISODate(new Date())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const done = (e: Extras) => { if (!cancelled) setExtras(e) }
    const lastOf = (appts: { startAt: string; status: string }[]) => {
      const now = Date.now()
      const past = appts.filter(a => (a.status === 'completada' || a.status === 'confirmada') && new Date(a.startAt).getTime() < now)
        .map(a => toLocalISODate(new Date(a.startAt))).sort()
      return past.length ? past[past.length - 1] : null
    }
    if (demoMode) {
      done({
        lastConsultationISO: lastOf(DEMO_APPOINTMENTS.filter(a => a.clientId === client.id)),
        metricDefs: DEMO_METRIC_DEFS, metricValues: client.id === 'demo-client-001' ? demoBodyMetrics(todayISO) : [],
        planChanges: DEMO_PLAN_CHANGES[client.id] ?? [], phases: demoPlanPhases(todayISO).filter(p => p.clientId === client.id),
      })
      return () => { cancelled = true }
    }
    Promise.all([
      supabase.from('appointments').select('*').eq('client_id', client.id).order('start_at', { ascending: false }).limit(50),
      supabase.from('metric_definitions').select('*').eq('nutricionista_id', client.nutricionistaId).order('sort_order'),
      supabase.from('body_metrics').select('*').eq('client_id', client.id).order('date'),
      supabase.from('diet_plan_changes').select('*').eq('client_id', client.id).order('changed_at'),
      supabase.from('plan_phases').select('*').eq('client_id', client.id).order('start_date'),
    ]).then(([ap, md, bm, pc, ph]) => done({
      lastConsultationISO: lastOf((ap.data || []).map(appointmentFromRow)),
      metricDefs: (md.data || []).map(metricDefinitionFromRow), metricValues: (bm.data || []).map(bodyMetricFromRow),
      planChanges: (pc.data || []) as DietPlanChangeRow[], phases: (ph.data || []).map(planPhaseFromRow),
    }))
    return () => { cancelled = true }
  }, [open, client.id, client.nutricionistaId, demoMode, todayISO])

  const brief = useMemo(() => {
    if (!extras) return null
    const alerts = computeClientAlerts({ checkins, weights, goal: client.goal, goalWeightKg: client.goalWeightKg, createdAt: client.createdAt }, new Date())
    return buildConsultationBrief({
      client: { goal: client.goal, goalWeightKg: client.goalWeightKg, createdAt: client.createdAt },
      todayISO, lastConsultationISO: extras.lastConsultationISO, weights, checkins, bloodMarkers,
      metricDefs: extras.metricDefs, metricValues: extras.metricValues, planChanges: extras.planChanges,
      clinicalNotes: clinicalNotes.map(n => ({ date: n.date, note: n.note })), phases: extras.phases, alerts,
    })
  }, [extras, checkins, weights, bloodMarkers, clinicalNotes, client, todayISO])

  const print = () => {
    if (!brief) return
    if (!printConsultationBrief(client, brief, branding)) toast('El navegador bloqueó la ventana: permite las ventanas emergentes', 'warn')
  }

  const section = 'text-xs font-bold uppercase tracking-wider text-muted mb-1.5'
  return (
    <Modal open={open} onClose={onClose} title={`Preparar la consulta · ${client.name}`} maxWidth="max-w-xl">
      <div className="p-5 space-y-4 overflow-y-auto text-sm">
        {!brief ? <p className="text-muted">Preparando el resumen…</p> : (
          <>
            <p className="text-xs text-muted">Periodo: {briefPeriodLabel(brief)}. Son pistas para la consulta, no un diagnóstico.</p>

            <div className="rounded-xl bg-accent/5 border border-accent/20 p-3">
              <p className={section}>Para hablar</p>
              {brief.talkingPoints.length === 0
                ? <p className="text-ok font-medium">Nada especial que destacar: todo sigue su curso.</p>
                : <ul className="space-y-1.5 list-disc pl-4">{brief.talkingPoints.map(p => <li key={p}>{p}</li>)}</ul>}
            </div>

            {brief.weight && (
              <div>
                <p className={section}>Peso</p>
                <p><b>{fmtKg(brief.weight.baselineKg)} → {fmtKg(brief.weight.latestKg)} kg</b> <span className="text-muted">({formatWeightDelta(brief.weight.deltaKg)} desde el {briefDate(brief.weight.baselineDate)})</span>
                  {brief.weight.remainingKg != null && <span className="text-muted"> · le faltan {fmtKg(brief.weight.remainingKg)} kg</span>}</p>
              </div>
            )}

            {brief.measurements.length > 0 && (
              <div><p className={section}>Medidas</p><ul className="space-y-0.5">{brief.measurements.map(m => <li key={m.name}>{describeMeasurement(m)}</li>)}</ul></div>
            )}

            <div>
              <p className={section}>Adherencia</p>
              <p>Última semana <b>{brief.adherence.last7}%</b>{brief.adherence.sincePct != null && <> · en el tramo <b>{brief.adherence.sincePct}%</b></>} <span className="text-muted">· {brief.checkinsSince} check-ins en el tramo</span></p>
              {brief.adherence.months.length > 0 && <MonthBars months={brief.adherence.months} />}
            </div>

            {brief.labs.length > 0 && (
              <div>
                <p className={section}>Analíticas fuera de rango</p>
                <ul className="space-y-0.5">{brief.labs.map(l => (
                  <li key={l.label}>{l.label}: <b>{fmtKg(l.value)} {l.unit}</b> <span className="text-muted">({l.status}, {l.date.split('-').reverse().join('/')})</span>{l.isNew && <b className="text-accent"> · nueva</b>}</li>
                ))}</ul>
              </div>
            )}

            <div>
              <p className={section}>Plan y fase</p>
              {brief.phase && <p>Fase <b>{brief.phase.name}</b> ({brief.phase.position} de {brief.phase.total}) · {brief.phase.daysLeft === 1 ? 'último día' : `quedan ${brief.phase.daysLeft} días`}</p>}
              {brief.planChanges.length === 0
                ? <p className="text-muted">Sin cambios en el plan en este tramo.</p>
                : <ul className="space-y-0.5">{brief.planChanges.map((c, i) => <li key={i}><span className="text-muted">{briefDate(c.date)}</span> · {c.text}</li>)}</ul>}
            </div>

            {brief.notes.length > 0 && (
              <div><p className={section}>Notas clínicas desde entonces</p><ul className="space-y-0.5">{brief.notes.map((n, i) => <li key={i}><span className="text-muted">{briefDate(n.date)}</span> · {n.note}</li>)}</ul></div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={print}><Printer className="w-3.5 h-3.5" /> Imprimir / PDF</Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** Barras de adherencia mes a mes (la misma lista que se ve en el resumen y en la tarjeta de adherencia). */
export function MonthBars({ months }: { months: { month: string; label: string; pct: number; checkinDays: number; daysCounted: number }[] }) {
  return (
    <ul className="mt-2 space-y-1.5" aria-label="Adherencia mes a mes">
      {months.map(m => (
        <li key={m.month} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-muted flex-shrink-0">{m.label}</span>
          <span className="flex-1 h-2 bg-bg-alt rounded-full overflow-hidden"><span className="block h-full bg-accent rounded-full" style={{ width: `${m.pct}%` }} /></span>
          <span className="w-10 text-right font-semibold">{m.pct}%</span>
          <span className="w-14 text-right text-muted">{m.checkinDays}/{m.daysCounted} d</span>
        </li>
      ))}
    </ul>
  )
}

