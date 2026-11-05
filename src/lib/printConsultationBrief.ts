import { ClientData } from '../types'
import { ConsultationBrief, describeMeasurement } from './consultationBrief'
import { formatWeightDelta } from './clientListSummary'
import { PrintBranding } from './printPlan'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const kg = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const dmy = (iso: string) => iso.split('-').reverse().join('/')
const SHORT_MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const briefDate = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${SHORT_MONTH[m - 1]}` }

/** El texto de qué tramo cubre el resumen: «desde la última consulta (14 oct, hace 21 días)» o «últimas 4 semanas». */
export function briefPeriodLabel(b: ConsultationBrief): string {
  return b.fromLastConsultation ? `desde la última consulta (${briefDate(b.since)}, hace ${b.daysSince} días)` : `últimas ${Math.round(b.daysSince / 7)} semanas (no hay una consulta anterior registrada)`
}

/** HTML imprimible del resumen: una página, sin enlaces ni cosas que no se lean en papel. Es para el nutricionista: lleva datos internos. */
export function buildConsultationBriefHtml(client: Pick<ClientData, 'name' | 'surname'>, b: ConsultationBrief, branding?: PrintBranding, todayLabel = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })): string {
  const accent = branding?.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(branding.accentColor) ? branding.accentColor : '#b5573d'
  const logo = branding?.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="">` : ''
  const section = (title: string, body: string) => body ? `<h2>${esc(title)}</h2>${body}` : ''
  const list = (items: string[]) => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : ''

  const points = b.talkingPoints.length
    ? list(b.talkingPoints.map(esc))
    : '<p class="ok">Nada especial que destacar: todo sigue su curso.</p>'

  const weight = b.weight
    ? `<p><b>${kg(b.weight.baselineKg)} → ${kg(b.weight.latestKg)} kg</b> (${esc(formatWeightDelta(b.weight.deltaKg))}) · del ${dmy(b.weight.baselineDate)} al ${dmy(b.weight.latestDate)}${b.weight.remainingKg != null ? ` · le faltan ${kg(b.weight.remainingKg)} kg para su objetivo (${kg(b.weight.goalKg!)} kg)` : ''}</p>`
    : '<p class="muted">No hay pesajes suficientes en este tramo.</p>'

  const measures = list(b.measurements.map(m => esc(describeMeasurement(m))))

  const months = b.adherence.months.length
    ? `<table class="months"><tr>${b.adherence.months.map(m => `<th>${esc(m.label)}</th>`).join('')}</tr><tr>${b.adherence.months.map(m => `<td><b>${m.pct}%</b><br><span class="muted">${m.checkinDays}/${m.daysCounted} d</span></td>`).join('')}</tr></table>`
    : ''
  const adherence = `<p>Última semana: <b>${b.adherence.last7}%</b>${b.adherence.sincePct != null ? ` · en este tramo: <b>${b.adherence.sincePct}%</b>` : ''} · check-ins en el tramo: <b>${b.checkinsSince}</b></p>${months}`

  const sig = b.signals
  const signals = sig.days > 0
    ? `<p>Última semana (${sig.days} check-in${sig.days === 1 ? '' : 's'}): hambre <b>${sig.hunger.avg ?? '—'}</b>/5 · energía <b>${sig.energy.avg ?? '—'}</b>/5 · ánimo <b>${sig.mood.avg ?? '—'}</b>/5${sig.digestion.daysWithData > 0 ? ` · digestión: ${sig.digestion.concerningDays} día${sig.digestion.concerningDays === 1 ? '' : 's'} con molestias` : ''}</p>`
    : '<p class="muted">Sin check-ins la última semana.</p>'

  const labs = list(b.labs.map(l => `${esc(l.label)}: <b>${kg(l.value)} ${esc(l.unit)}</b> (${l.status}) · ${dmy(l.date)}${l.isNew ? ' <b class="new">nueva</b>' : ''}`))
  const plan = [
    b.phase ? `<p>Fase actual: <b>${esc(b.phase.name)}</b> (${b.phase.position} de ${b.phase.total}) · ${b.phase.daysLeft === 1 ? 'último día' : `quedan ${b.phase.daysLeft} días`}</p>` : '',
    b.planChanges.length ? list(b.planChanges.map(c => `${dmy(c.date)} · ${esc(c.text)}`)) : '<p class="muted">Sin cambios en el plan en este tramo.</p>',
  ].join('')
  const notes = list(b.notes.map(n => `${dmy(n.date)} · ${esc(n.note)}`))

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Preparar la consulta — ${esc(client.name)} ${esc(client.surname)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #2a2620; max-width: 760px; margin: 28px auto; padding: 0 24px; font-size: 13px; line-height: 1.45; }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .logo { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  h1 { font-size: 20px; margin: 0; }
  .sub { color: #8a8278; margin: 2px 0 14px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: ${accent}; margin: 16px 0 6px; border-bottom: 1px solid #e5e0d5; padding-bottom: 3px; }
  ul { margin: 4px 0; padding-left: 18px; } li { margin: 2px 0; }
  p { margin: 4px 0; } .muted { color: #8a8278; } .ok { color: #3f7d4a; }
  .points { background: #f3f5ee; border-left: 3px solid ${accent}; border-radius: 8px; padding: 6px 12px 8px; }
  .points h2 { border: 0; margin-top: 6px; }
  .new { color: ${accent}; }
  table.months { border-collapse: collapse; margin-top: 6px; } table.months th { font-size: 11px; color: #8a8278; font-weight: 600; padding: 2px 14px 2px 0; text-align: left; } table.months td { padding: 0 14px 4px 0; vertical-align: top; }
  footer { margin-top: 22px; font-size: 11px; color: #8a8278; }
  @media print { body { margin: 0; padding: 14px; } }
</style></head><body>
  <div class="head">${logo}<h1>${esc(client.name)} ${esc(client.surname)}</h1></div>
  <p class="sub">Preparar la consulta · ${esc(todayLabel)} · ${esc(briefPeriodLabel(b))}</p>
  <div class="points"><h2>Para hablar</h2>${points}</div>
  ${section('Peso', weight)}
  ${section('Medidas', measures)}
  ${section('Adherencia', adherence)}
  ${section('Señales', signals)}
  ${section('Analíticas fuera de rango', labs)}
  ${section('Plan y fase', plan)}
  ${section('Notas clínicas desde entonces', notes)}
  <footer>Resumen interno para el nutricionista, generado con los datos de NutriFit. Son pistas para la consulta, no un diagnóstico.</footer>
</body></html>`
}

export function printConsultationBrief(client: Pick<ClientData, 'name' | 'surname'>, b: ConsultationBrief, branding?: PrintBranding) {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(buildConsultationBriefHtml(client, b, branding))
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
  return true
}
