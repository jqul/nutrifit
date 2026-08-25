import { ClientData, WeightEntry, DailyCheckin } from '../types'
import { BloodMarkerRow } from './supabase-types'
import { BLOOD_MARKER_MAP, evaluateMarker, adviceForMarker } from './bloodMarkers'
import { calcAdherence, calcStreak } from './adherence'
import { calcBmi, bmiCategory, BmiCategory } from './bmi'
import { PrintBranding } from './printPlan'

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
    ? `<div class="stat"><b>${changeKg <= 0 ? '−' : '+'}${Math.abs(Math.round((changeKg / weeks) * 100) / 100)}kg</b><span>Ritmo medio/semana</span></div>`
    : ''

  const bmiFirst = heightCm ? calcBmi(first.weightKg, heightCm) : null
  const bmiLast = heightCm ? calcBmi(last.weightKg, heightCm) : null
  const bmiHtml = bmiFirst != null && bmiLast != null ? `
    <p class="muted-note">
      IMC inicial: <strong>${bmiFirst.toFixed(1)}</strong> (${esc(BMI_CATEGORY_LABEL[bmiCategory(bmiFirst)])})
      · IMC actual: <strong>${bmiLast.toFixed(1)}</strong> (${esc(BMI_CATEGORY_LABEL[bmiCategory(bmiLast)])})
    </p>` : ''

  return `
    <div class="stats">
      <div class="stat"><b>${first.weightKg}kg</b><span>Peso inicial</span></div>
      <div class="stat"><b>${last.weightKg}kg</b><span>Peso actual</span></div>
      ${goalKg != null ? `<div class="stat"><b>${goalKg}kg</b><span>Peso objetivo</span></div>` : ''}
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
       <text x="${W - PAD}" y="${y(goalKg) - 4}" text-anchor="end" font-size="10" fill="#8a8278">Meta: ${goalKg}kg</text>`
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
    <p class="muted-note">Variación total: <strong>${last - first > 0 ? '+' : ''}${Math.round((last - first) * 10) / 10}kg</strong></p>
  `
}

export interface ProgressReportData {
  weights: WeightEntry[]
  checkins: DailyCheckin[]
  bloodMarkers: BloodMarkerRow[]
}

/**
 * Informe de evolución clínico en PDF: peso inicial vs actual con gráfica,
 * adherencia/racha, y las últimas analíticas con su estado — pensado para
 * enviar al cliente o a su médico. Mismo patrón que el resto de PDFs de la
 * app (HTML + window.print(), sin librería de generación de PDF).
 */
export function printProgressReport(client: ClientData, data: ProgressReportData, branding?: PrintBranding) {
  const win = window.open('', '_blank')
  if (!win) return

  const accent = branding?.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(branding.accentColor) ? branding.accentColor : '#b5573d'
  const logoHtml = branding?.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="">` : ''
  const today = new Date()
  const todayLabel = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const adherence7d = calcAdherence(data.checkins, 7, today)
  const adherence30d = calcAdherence(data.checkins, 30, today)
  const streak = calcStreak(data.checkins, today)

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

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe de evolución — ${esc(client.name)} ${esc(client.surname)}</title>
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
  .advice-note { font-size: 10px; color: #8a8278; font-weight: 400; margin-top: 2px; }
  h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: ${accent}; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: #8a8278; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 4px 6px; border-bottom: 1px solid #e5e0d5; }
  td { padding: 6px; border-bottom: 1px solid #f0ede4; vertical-align: top; }
  footer { margin-top: 32px; font-size: 11px; color: #8a8278; text-align: center; }
  @media print { body { margin: 0; padding: 16px; } .card { page-break-inside: avoid; } }
</style>
</head>
<body>
  ${logoHtml ? `<div class="brand">${logoHtml}<h1 style="margin:0">${esc(client.name)} ${esc(client.surname)}</h1></div>` : `<h1>${esc(client.name)} ${esc(client.surname)}</h1>`}
  <p class="sub">Informe de evolución — generado el ${esc(todayLabel)}</p>

  <div class="stats">
    <div class="stat"><b>${streak}d</b><span>Racha actual</span></div>
    <div class="stat"><b>${adherence7d}%</b><span>Adherencia 7 días</span></div>
    <div class="stat"><b>${adherence30d}%</b><span>Adherencia 30 días</span></div>
  </div>

  <div class="card">
    <h3>Resumen antropométrico</h3>
    ${anthropometricSummaryHtml(data.weights, client.goalWeightKg, client.heightCm)}
    ${weightChartSvg(data.weights, client.goalWeightKg, accent)}
  </div>

  <div class="card">
    <h3>Analíticas recientes</h3>
    ${markersHtml}
  </div>

  ${client.reportNotes.trim() ? `
  <div class="card">
    <h3>Notas y conclusiones del profesional</h3>
    <p style="font-size:13px; white-space: pre-wrap; margin: 0;">${esc(client.reportNotes.trim())}</p>
  </div>` : ''}

  <footer>NutriFit — informe orientativo, no sustituye la valoración médica.</footer>
</body>
</html>`

  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
