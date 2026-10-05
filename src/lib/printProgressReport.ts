import { ClientData, WeightEntry, DailyCheckin } from '../types'
import { goalLabel } from './constants'
import { buildReportSummary, ReportPeriod, ReportReviewInput, ReportSummary, PERIOD_LABEL, AverageChange } from './reportSummary'
import { formatPlanChange } from './planChanges'
import { DietPlanChangeRow } from './supabase-types'
import { BloodMarkerRow } from './supabase-types'
import { BLOOD_MARKER_MAP, evaluateMarker, adviceForMarker } from './bloodMarkers'
import { calcStreak } from './adherence'
import { calcBmi, bmiCategory, BmiCategory } from './bmi'
import { PrintBranding } from './printPlan'

/** 66.6 → "66,6"; 64 → "64" (sin decimal si es entero). */
const kgNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const BMI_CATEGORY_LABEL: Record<BmiCategory, string> = {
  'bajo peso': 'Bajo peso', normal: 'Normopeso', sobrepeso: 'Sobrepeso', obesidad: 'Obesidad',
}

/** Resumen antropométrico: peso inicial vs actual vs objetivo, ritmo medio
 * de cambio semanal, e IMC inicial vs actual con clasificación OMS — un
 * vistazo clínico rápido antes de entrar en la gráfica. */
function anthropometricSummaryHtml(entries: WeightEntry[], goalKg: number | null, heightCm: number | null): string {
  if (entries.length === 0) return ''
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0], last = sorted[sorted.length - 1]
  const changeKg = last.weightKg - first.weightKg
  const days = (new Date(last.date + 'T00:00:00').getTime() - new Date(first.date + 'T00:00:00').getTime()) / 86400000
  const weeks = days / 7
  const weeklyRateHtml = weeks >= 1
    ? `<div class="stat"><b>${changeKg <= 0 ? '−' : '+'}${kgNum(Math.abs(Math.round((changeKg / weeks) * 100) / 100))} kg</b><span>Ritmo medio/semana</span></div>`
    : ''

  const bmiFirst = heightCm ? calcBmi(first.weightKg, heightCm) : null
  const bmiLast = heightCm ? calcBmi(last.weightKg, heightCm) : null
  const bmiHtml = bmiFirst != null && bmiLast != null ? `
    <p class="muted-note">
      IMC inicial: <strong>${kgNum(bmiFirst)}</strong> (${esc(BMI_CATEGORY_LABEL[bmiCategory(bmiFirst)])})
      · IMC actual: <strong>${kgNum(bmiLast)}</strong> (${esc(BMI_CATEGORY_LABEL[bmiCategory(bmiLast)])})
    </p>` : ''

  return `
    <div class="stats">
      <div class="stat"><b>${kgNum(first.weightKg)} kg</b><span>Peso inicial</span></div>
      <div class="stat"><b>${kgNum(last.weightKg)} kg</b><span>Peso actual</span></div>
      ${goalKg != null ? `<div class="stat"><b>${kgNum(goalKg)} kg</b><span>Peso objetivo</span></div>` : ''}
      ${weeklyRateHtml}
    </div>
    ${bmiHtml}
  `
}

/** Gráfica de evolución de peso — SVG dibujado a mano (sin dependencias,
 * igual que el resto de la generación de PDF: HTML + window.print()). */
function weightChartSvg(entries: WeightEntry[], goalKg: number | null, accent: string): string {
  if (entries.length === 0) return '<p class="muted-note">Sin registros de peso todavía.</p>'
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const W = 640, H = 180, PAD = 24
  const values = sorted.map(e => e.weightKg)
  const withGoal = goalKg != null ? [...values, goalKg] : values
  const min = Math.min(...withGoal), max = Math.max(...withGoal)
  const range = max - min || 1
  const x = (i: number) => PAD + (i / Math.max(1, sorted.length - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2)
  const points = sorted.map((e, i) => `${x(i)},${y(e.weightKg)}`).join(' ')
  const goalLine = goalKg != null
    ? `<line x1="${PAD}" y1="${y(goalKg)}" x2="${W - PAD}" y2="${y(goalKg)}" stroke="#8a8278" stroke-width="1" stroke-dasharray="4,4" />
       <text x="${W - PAD}" y="${y(goalKg) - 4}" text-anchor="end" font-size="10" fill="#8a8278">Meta: ${kgNum(goalKg)} kg</text>`
    : ''
  const first = sorted[0].weightKg, last = sorted[sorted.length - 1].weightKg
  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
      ${goalLine}
      <polyline points="${points}" fill="none" stroke="${accent}" stroke-width="2.5" />
      ${sorted.map((e, i) => `<circle cx="${x(i)}" cy="${y(e.weightKg)}" r="3" fill="${accent}" />`).join('')}
      <text x="${PAD}" y="${H - 6}" font-size="10" fill="#8a8278">${esc(new Date(sorted[0].date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</text>
      <text x="${W - PAD}" y="${H - 6}" text-anchor="end" font-size="10" fill="#8a8278">${esc(new Date(sorted[sorted.length - 1].date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</text>
    </svg>
    <p class="muted-note">Variación total: <strong>${last - first > 0 ? '+' : last - first < 0 ? '−' : ''}${kgNum(Math.abs(last - first))} kg</strong></p>
  `
}

export interface ProgressReportData {
  weights: WeightEntry[]
  checkins: DailyCheckin[]
  bloodMarkers: BloodMarkerRow[]
  /** Solo el nutricionista los tiene (el cliente no puede leerlos): cambios de objetivos del plan. */
  planChanges?: DietPlanChangeRow[]
  /** Solo el nutricionista: sus valoraciones semanales. */
  reviews?: ReportReviewInput[]
}

/** Qué incluye el informe. Todo lo que no es peso/adherencia es opcional. */
export interface ReportOptions {
  period: ReportPeriod
  sections: {
    /** Hambre, energía, ánimo y digestión del periodo. */
    signals: boolean
    /** Cambios de kcal/macros del plan con su motivo (necesita data.planChanges). */
    planChanges: boolean
    /** Valoraciones que el nutricionista escribió con sus palabras (necesita data.reviews). */
    reviews: boolean
    bloodMarkers: boolean
    /** Notas y conclusiones del profesional (client.reportNotes). */
    notes: boolean
  }
}

/** Informe completo del historial, sin material interno: lo que ya generaba el botón del cliente. */
export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  period: 'all',
  sections: { signals: true, planChanges: false, reviews: false, bloodMarkers: true, notes: true },
}

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const fmt1 = (n: number) => n.toFixed(1).replace('.', ',')
const signedKg = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1).replace('.', ',')} kg`

function averageRow(label: string, c: AverageChange, higherIsBetter: boolean | null): string {
  if (c.avg == null) return `<tr><td>${label}</td><td>—</td><td></td></tr>`
  let delta = ''
  if (c.prevAvg != null) {
    const d = Math.round((c.avg - c.prevAvg) * 10) / 10
    const good = d === 0 || higherIsBetter == null ? null : (d > 0) === higherIsBetter
    const color = good == null ? '#8a8278' : good ? '#4a7a3d' : '#b5573d'
    delta = `<span style="color:${color}">${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1).replace('.', ',')} vs periodo anterior</span>`
  }
  return `<tr><td>${label}</td><td><b>${fmt1(c.avg)}/5</b></td><td>${delta}</td></tr>`
}

function signalsHtml(summary: ReportSummary): string {
  const sg = summary.signals
  if (!sg) return '<p class="muted-note">Sin check-ins en este periodo.</p>'
  const digestion = sg.digestionDaysWithData === 0
    ? '—'
    : sg.concerningDigestionDays === 0 ? '<b>Sin molestias</b>' : `<b>${sg.concerningDigestionDays} día${sg.concerningDigestionDays === 1 ? '' : 's'} con molestias</b> de ${sg.digestionDaysWithData} registrados`
  return `
    <table>
      <thead><tr><th>Indicador</th><th>Media del periodo</th><th>Cambio</th></tr></thead>
      <tbody>
        ${averageRow('Hambre', sg.hunger, false)}
        ${averageRow('Energía', sg.energy, true)}
        ${averageRow('Ánimo', sg.mood, true)}
        <tr><td>Digestión</td><td colspan="2">${digestion}</td></tr>
      </tbody>
    </table>`
}

function planChangesHtml(summary: ReportSummary): string {
  if (summary.planChanges.length === 0) return '<p class="muted-note">No ha habido cambios en los objetivos del plan durante este periodo.</p>'
  return `<ul class="timeline">${summary.planChanges.map(c => `
    <li>
      <b>${esc(new Date(c.changed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }))}</b>
      <div>${c.changes.map(x => esc(formatPlanChange(x))).join(' · ')}</div>
      ${c.reason ? `<div class="advice-note">Motivo: ${esc(c.reason)}</div>` : ''}
    </li>`).join('')}</ul>`
}

function reviewsHtml(summary: ReportSummary): string {
  return `<ul class="timeline">${summary.reviewNotes.map(r => `
    <li><b>Semana del ${esc(fmtDate(r.weekStart))}</b><div style="white-space: pre-wrap">${esc(r.note)}</div></li>`).join('')}</ul>`
}

/**
 * Informe de progreso en PDF para un periodo: peso de inicio a fin con gráfica,
 * adherencia frente al periodo anterior, señales (hambre, energía, ánimo,
 * digestión), cambios del plan, analíticas y las notas del profesional —
 * pensado para entregar al cliente o a su médico. Qué secciones lleva lo elige
 * quien lo genera (ReportOptions). Mismo patrón que el resto de PDFs de la app
 * (HTML + window.print(), sin librería de generación de PDF).
 */
export function buildProgressReportHtml(
  client: ClientData, data: ProgressReportData, branding?: PrintBranding, options: ReportOptions = DEFAULT_REPORT_OPTIONS, today = new Date(),
): string {
  const accent = branding?.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(branding.accentColor) ? branding.accentColor : '#b5573d'
  const logoHtml = branding?.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="">` : ''
  const todayLabel = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const summary = buildReportSummary(data, options.period, today)
  const periodWeights = options.period === 'all' ? data.weights : summary.weight?.entries ?? data.weights.filter(w => w.date >= summary.range.start)
  const streak = calcStreak(data.checkins, today)
  const sec = options.sections

  const weightStat = summary.weight
    ? `<div class="stat"><b>${signedKg(summary.weight.changeKg)}</b><span>Peso (${kgNum(summary.weight.startKg)} → ${kgNum(summary.weight.endKg)} kg)</span></div>`
    : `<div class="stat"><b>—</b><span>Peso (sin cambio medible)</span></div>`
  const adherenceDelta = summary.adherence.prevPct != null
    ? ` (${summary.adherence.pct - summary.adherence.prevPct >= 0 ? '+' : '−'}${Math.abs(summary.adherence.pct - summary.adherence.prevPct)} pts)`
    : ''

  const recentMarkers = [...data.bloodMarkers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
  const markersHtml = recentMarkers.length === 0 ? '<p class="muted-note">Sin analíticas registradas.</p>' : `
    <table>
      <thead><tr><th>Fecha</th><th>Marcador</th><th>Valor</th><th>Estado</th></tr></thead>
      <tbody>
        ${recentMarkers.map(m => {
          const def = BLOOD_MARKER_MAP[m.marker_key]
          if (!def) return ''
          const status = evaluateMarker(def, m.value)
          const advice = adviceForMarker(def, m.value)
          const statusLabel = status === 'normal' ? 'Normal' : status === 'alto' ? 'Alto' : 'Bajo'
          const statusColor = status === 'normal' ? '#4a7a3d' : '#b5573d'
          return `<tr>
            <td>${esc(new Date(m.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }))}</td>
            <td>${esc(def.label)}</td>
            <td>${m.value} ${esc(def.unit)}</td>
            <td style="color:${statusColor}; font-weight: 600;">${statusLabel}${advice ? `<div class="advice-note">${esc(advice)}</div>` : ''}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  `

  const goalLine = client.goal ? `Objetivo: ${esc(goalLabel(client.goal))} · ` : ''
  const periodLine = options.period === 'all'
    ? `Todo el historial (desde el ${esc(fmtDate(summary.range.start))})`
    : `${esc(PERIOD_LABEL[options.period])}: ${esc(fmtDate(summary.range.start))} → ${esc(fmtDate(summary.range.end))}`

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe de progreso — ${esc(client.name)} ${esc(client.surname)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #2a2620; max-width: 720px; margin: 32px auto; padding: 0 24px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .logo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .sub { color: #8a8278; font-size: 13px; margin-bottom: 24px; }
  .stats { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat { flex: 1; text-align: center; border: 1px solid #e5e0d5; border-radius: 12px; padding: 10px; }
  .stat b { display: block; font-size: 18px; color: ${accent}; }
  .stat span { font-size: 10px; text-transform: uppercase; color: #8a8278; letter-spacing: .04em; }
  .card { border: 1px solid #e5e0d5; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .muted-note { font-size: 12px; color: #8a8278; margin: 6px 0 0; }
  .advice-note { font-size: 11px; color: #8a8278; font-weight: 400; margin-top: 2px; }
  h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: ${accent}; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: #8a8278; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 4px 6px; border-bottom: 1px solid #e5e0d5; }
  td { padding: 6px; border-bottom: 1px solid #f0ede4; vertical-align: top; }
  ul.timeline { list-style: none; margin: 0; padding: 0; font-size: 13px; }
  ul.timeline li { padding: 8px 0; border-bottom: 1px solid #f0ede4; }
  ul.timeline li:last-child { border-bottom: 0; }
  footer { margin-top: 32px; font-size: 11px; color: #8a8278; text-align: center; }
  @media print { body { margin: 0; padding: 16px; } .card { page-break-inside: avoid; } }
</style>
</head>
<body>
  ${logoHtml ? `<div class="brand">${logoHtml}<h1 style="margin:0">${esc(client.name)} ${esc(client.surname)}</h1></div>` : `<h1>${esc(client.name)} ${esc(client.surname)}</h1>`}
  <p class="sub">Informe de progreso — ${goalLine}${periodLine} · generado el ${esc(todayLabel)}</p>

  <div class="stats">
    ${weightStat}
    <div class="stat"><b>${summary.adherence.pct}%</b><span>Adherencia${adherenceDelta}</span></div>
    <div class="stat"><b>${summary.checkins.done}/${summary.checkins.days}</b><span>Check-ins</span></div>
    <div class="stat"><b>${streak}d</b><span>Racha actual</span></div>
  </div>

  <div class="card">
    <h3>Evolución del peso</h3>
    ${anthropometricSummaryHtml(periodWeights, client.goalWeightKg, client.heightCm)}
    ${weightChartSvg(periodWeights, client.goalWeightKg, accent)}
  </div>

  ${sec.signals ? `<div class="card"><h3>Hábitos y señales</h3>${signalsHtml(summary)}</div>` : ''}

  ${sec.planChanges ? `<div class="card"><h3>Cambios en el plan</h3>${planChangesHtml(summary)}</div>` : ''}

  ${sec.reviews && summary.reviewNotes.length > 0 ? `<div class="card"><h3>Valoración del profesional</h3>${reviewsHtml(summary)}</div>` : ''}

  ${sec.bloodMarkers ? `<div class="card"><h3>Analíticas recientes</h3>${markersHtml}</div>` : ''}

  ${sec.notes && client.reportNotes.trim() ? `
  <div class="card">
    <h3>Observaciones y próximos objetivos</h3>
    <p style="font-size:13px; white-space: pre-wrap; margin: 0;">${esc(client.reportNotes.trim())}</p>
  </div>` : ''}

  <footer>NutriFit — informe orientativo, no sustituye la valoración médica.</footer>
</body>
</html>`

  return html
}

/**
 * Abre el informe en una ventana de impresión. Si hay que esperar datos antes
 * (cambios del plan, valoraciones), abre la ventana al hacer clic y pásala como
 * `targetWindow`: los navegadores bloquean las ventanas abiertas tras una espera.
 */
export function printProgressReport(
  client: ClientData, data: ProgressReportData, branding?: PrintBranding, options: ReportOptions = DEFAULT_REPORT_OPTIONS,
  targetWindow?: Window | null,
) {
  const win = targetWindow ?? window.open('', '_blank')
  if (!win) return
  const html = buildProgressReportHtml(client, data, branding, options)
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
