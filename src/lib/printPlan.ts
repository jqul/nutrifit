import { ClientData, DietPlan } from '../types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Abre una pestaña nueva con una vista imprimible del plan y lanza el diálogo
 * de impresión del navegador — el usuario elige "Guardar como PDF" ahí mismo.
 * No usamos ninguna librería de generación de PDF: es HTML + window.print().
 */
export function printDietPlan(client: ClientData, plan: DietPlan) {
  const win = window.open('', '_blank')
  if (!win) return

  const visibleSupplements = plan.supplements.filter(s => s.visibleToClient)
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const mealsHtml = plan.meals.map(meal => `
    <div class="meal">
      <div class="meal-head">
        <strong>${esc(meal.name)}</strong>
        <span>${meal.time ? esc(meal.time) : ''}${meal.kcalTarget != null ? ` · ${meal.kcalTarget} kcal` : ''}</span>
      </div>
      ${meal.items.length ? `<ul>${meal.items.map(i => `<li><span>${esc(i.foodName)}</span><span>${esc(i.quantity)} ${esc(i.unit)}</span></li>`).join('')}</ul>` : ''}
    </div>
  `).join('')

  const supplementsHtml = visibleSupplements.length ? `
    <h3>Suplementación</h3>
    <ul class="supplements">
      ${visibleSupplements.map(s => `<li><span>${esc(s.name)}</span><span>${esc(s.dose)} · ${esc(s.timing)}</span></li>`).join('')}
    </ul>
  ` : ''

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Plan de dieta — ${esc(client.name)} ${esc(client.surname)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #2a2620; max-width: 720px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .sub { color: #8a8278; font-size: 13px; margin-bottom: 24px; }
  .macros { display: flex; gap: 12px; margin-bottom: 24px; }
  .macro { flex: 1; text-align: center; border: 1px solid #e5e0d5; border-radius: 12px; padding: 10px; }
  .macro b { display: block; font-size: 18px; }
  .macro span { font-size: 10px; text-transform: uppercase; color: #8a8278; letter-spacing: .04em; }
  .advice { background: #f3f5ee; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px; font-size: 14px; }
  .meal { border: 1px solid #e5e0d5; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  .meal-head { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; color: #8a8278; }
  .meal-head strong { color: #2a2620; }
  ul { list-style: none; padding: 0; margin: 0; }
  ul li { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: #4a463d; }
  .supplements li { border-bottom: 1px solid #e5e0d5; padding: 6px 0; }
  h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #8a8278; margin: 20px 0 10px; }
  footer { margin-top: 32px; font-size: 11px; color: #8a8278; text-align: center; }
  @media print { body { margin: 0; padding: 16px; } }
</style>
</head>
<body>
  <h1>${esc(client.name)} ${esc(client.surname)}</h1>
  <p class="sub">Plan de dieta — generado el ${esc(today)}</p>
  <div class="macros">
    <div class="macro"><b>${plan.kcalTarget}</b><span>Kcal</span></div>
    <div class="macro"><b>${plan.proteinG}g</b><span>Proteína</span></div>
    <div class="macro"><b>${plan.carbsG}g</b><span>Carbos</span></div>
    <div class="macro"><b>${plan.fatG}g</b><span>Grasas</span></div>
  </div>
  ${plan.advice ? `<div class="advice">${esc(plan.advice)}</div>` : ''}
  <h3>Comidas</h3>
  ${mealsHtml}
  ${supplementsHtml}
  <footer>NutriFit — nutrefit.netlify.app</footer>
</body>
</html>`

  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
