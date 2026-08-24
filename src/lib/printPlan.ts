import { ClientData, DietPlan, DietMeal } from '../types'

export interface PrintBranding { logoUrl?: string | null; accentColor?: string | null }

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function mealHtml(meal: DietMeal): string {
  const labelHtml = meal.optionLabel ? `<span class="option-tag">${esc(meal.optionLabel)}</span>` : ''
  const dayTypeHtml = meal.dayType === 'on' ? `<span class="daytype-tag daytype-on">🔥 Día ON</span>`
    : meal.dayType === 'off' ? `<span class="daytype-tag daytype-off">🌙 Día OFF</span>` : ''
  return `
    <div class="meal">
      <div class="meal-head">
        <strong>${labelHtml}${esc(meal.name)}</strong>
        <span>${dayTypeHtml}${meal.time ? esc(meal.time) : ''}${meal.kcalTarget != null ? ` · ${meal.kcalTarget} kcal` : ''}</span>
      </div>
      ${meal.items.length ? `<ul>${meal.items.map(i => `<li><span>${esc(i.foodName)}</span><span>${esc(i.quantity)} ${esc(i.unit)}</span></li>`).join('')}</ul>` : ''}
    </div>
  `
}

/** Agrupa comidas por optionGroup (pauta flexible por opciones) — igual
 * lógica que en PlanDietaTab/DietaClienteTab, duplicada aquí porque este
 * módulo genera HTML plano sin depender de los componentes de React. */
function groupMeals(meals: DietMeal[]): DietMeal[][] {
  const groups: DietMeal[][] = []
  const byGroupId = new Map<string, DietMeal[]>()
  for (const m of meals) {
    if (m.optionGroup) {
      let g = byGroupId.get(m.optionGroup)
      if (!g) { g = []; byGroupId.set(m.optionGroup, g); groups.push(g) }
      g.push(m)
    } else {
      groups.push([m])
    }
  }
  return groups
}

function mealGroupHtml(group: DietMeal[]): string {
  if (group.length === 1 && !group[0].optionGroup) return mealHtml(group[0])
  return `<div class="option-group"><p class="option-group-label">Opciones intercambiables — elige una</p>${group.map(mealHtml).join('')}</div>`
}

/**
 * Abre una pestaña nueva con una vista imprimible del plan y lanza el diálogo
 * de impresión del navegador — el usuario elige "Guardar como PDF" ahí mismo.
 * No usamos ninguna librería de generación de PDF: es HTML + window.print().
 */
export function printDietPlan(client: ClientData, plan: DietPlan, branding?: PrintBranding) {
  const win = window.open('', '_blank')
  if (!win) return

  const accent = branding?.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(branding.accentColor) ? branding.accentColor : '#b5573d'
  const logoHtml = branding?.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="">` : ''

  const visibleSupplements = plan.supplements.filter(s => s.visibleToClient)
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  // Cuadrante semanal: si alguna comida tiene un día asignado, se agrupan
  // por día (más una sección "Cada día" para las que no tienen uno). Si
  // ninguna lo tiene (plan de un solo día tipo, el caso de siempre), se
  // muestran igual que antes, sin cabeceras de día.
  const usesWeeklyMenu = plan.meals.some(m => m.dayOfWeek != null)
  const everyDayMeals = plan.meals.filter(m => m.dayOfWeek == null)
  const mealsHtml = !usesWeeklyMenu ? groupMeals(plan.meals).map(mealGroupHtml).join('') : (
    DAY_LABELS.map((label, day) => {
      const dayMeals = plan.meals.filter(m => m.dayOfWeek === day)
      if (dayMeals.length === 0 && everyDayMeals.length === 0) return ''
      return `<h3>${esc(label)}</h3>${groupMeals(dayMeals).map(mealGroupHtml).join('')}${groupMeals(everyDayMeals).map(mealGroupHtml).join('')}`
    }).join('')
  )

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
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .logo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .sub { color: #8a8278; font-size: 13px; margin-bottom: 24px; }
  .macros { display: flex; gap: 12px; margin-bottom: 24px; }
  .macro { flex: 1; text-align: center; border: 1px solid #e5e0d5; border-radius: 12px; padding: 10px; }
  .macro b { display: block; font-size: 18px; color: ${accent}; }
  .macro span { font-size: 10px; text-transform: uppercase; color: #8a8278; letter-spacing: .04em; }
  .advice { background: #f3f5ee; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px; font-size: 14px; border-left: 3px solid ${accent}; }
  .meal { border: 1px solid #e5e0d5; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  .meal-head { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; color: #8a8278; }
  .meal-head strong { color: #2a2620; }
  .option-group { border: 1px dashed ${accent}; border-radius: 14px; padding: 10px; margin-bottom: 10px; }
  .option-group .meal { margin-bottom: 6px; }
  .option-group .meal:last-child { margin-bottom: 0; }
  .option-group-label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: ${accent}; margin: 0 0 8px 4px; font-weight: 700; }
  .option-tag { color: ${accent}; font-weight: 700; margin-right: 6px; }
  .daytype-tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; margin-right: 6px; }
  .daytype-on { background: #fbe8d3; color: #a8710a; }
  .daytype-off { background: #dde6f5; color: #3a5a9c; }
  ul { list-style: none; padding: 0; margin: 0; }
  ul li { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: #4a463d; }
  .supplements li { border-bottom: 1px solid #e5e0d5; padding: 6px 0; }
  h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: ${accent}; margin: 20px 0 10px; }
  footer { margin-top: 32px; font-size: 11px; color: #8a8278; text-align: center; }
  @media print { body { margin: 0; padding: 16px; } }
</style>
</head>
<body>
  ${logoHtml ? `<div class="brand">${logoHtml}<h1 style="margin:0">${esc(client.name)} ${esc(client.surname)}</h1></div>` : `<h1>${esc(client.name)} ${esc(client.surname)}</h1>`}
  <p class="sub">Plan de dieta — generado el ${esc(today)}</p>
  <div class="macros">
    <div class="macro"><b>${plan.kcalTarget}</b><span>Kcal</span></div>
    <div class="macro"><b>${plan.proteinG}g</b><span>Proteína</span></div>
    <div class="macro"><b>${plan.carbsG}g</b><span>Carbos</span></div>
    <div class="macro"><b>${plan.fatG}g</b><span>Grasas</span></div>
    <div class="macro"><b>${plan.fiberG}g</b><span>Fibra</span></div>
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
