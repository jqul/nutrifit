import { PrintBranding } from './printPlan'

interface RecipeBookItem {
  foodName: string; quantity: string; unit: string
  kcal?: string | null; proteinG?: string | null; carbsG?: string | null; fatG?: string | null; fiberG?: string | null
}
interface RecipeBookEntry {
  name: string
  photoUrl?: string | null
  steps?: string | null
  items: RecipeBookItem[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sum(items: RecipeBookItem[], key: keyof RecipeBookItem): number {
  return items.reduce((acc, i) => acc + (parseFloat(String(i[key] ?? '')) || 0), 0)
}

/**
 * Recetario en PDF: igual que printDietPlan (HTML + window.print(), sin
 * librería de generación de PDF), pero para el conjunto de recetas del
 * nutricionista en vez de un plan de un cliente concreto.
 */
export function printRecipeBook(nutricionistaName: string, recipes: RecipeBookEntry[], branding?: PrintBranding) {
  const win = window.open('', '_blank')
  if (!win) return

  const accent = branding?.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(branding.accentColor) ? branding.accentColor : '#b5573d'
  const logoHtml = branding?.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="">` : ''

  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const recipesHtml = recipes.map(r => {
    const kcal = Math.round(sum(r.items, 'kcal'))
    const protein = Math.round(sum(r.items, 'proteinG') * 10) / 10
    const carbs = Math.round(sum(r.items, 'carbsG') * 10) / 10
    const fat = Math.round(sum(r.items, 'fatG') * 10) / 10
    const fiber = Math.round(sum(r.items, 'fiberG') * 10) / 10
    return `
    <div class="recipe">
      ${r.photoUrl ? `<img class="photo" src="${esc(r.photoUrl)}" alt="">` : ''}
      <div class="recipe-body">
        <h2>${esc(r.name)}</h2>
        <div class="macros">
          <span><b>${kcal}</b> kcal</span>
          <span><b>${protein}g</b> prot.</span>
          <span><b>${carbs}g</b> carbos</span>
          <span><b>${fat}g</b> grasas</span>
          <span><b>${fiber}g</b> fibra</span>
        </div>
        <ul>
          ${r.items.map(i => `<li><span>${esc(i.foodName)}</span><span>${esc(i.quantity)} ${esc(i.unit)}</span></li>`).join('')}
        </ul>
        ${r.steps ? `<div class="steps"><b>Preparación</b><p>${esc(r.steps).replace(/\n/g, '<br>')}</p></div>` : ''}
      </div>
    </div>`
  }).join('')

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recetario — ${esc(nutricionistaName)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #2a2620; max-width: 720px; margin: 32px auto; padding: 0 24px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .logo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .sub { color: #8a8278; font-size: 13px; margin-bottom: 24px; }
  .recipe { display: flex; gap: 14px; border: 1px solid #e5e0d5; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid; }
  .recipe .photo { width: 96px; height: 96px; object-fit: cover; border-radius: 10px; flex-shrink: 0; }
  .recipe-body { flex: 1; min-width: 0; }
  .recipe h2 { font-size: 15px; margin: 0 0 6px; color: ${accent}; }
  .macros { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: #8a8278; margin-bottom: 8px; }
  .macros b { color: #2a2620; }
  ul { list-style: none; padding: 0; margin: 0; }
  ul li { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; color: #4a463d; }
  .steps { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e0d5; }
  .steps b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #8a8278; margin-bottom: 3px; }
  .steps p { font-size: 12px; color: #4a463d; margin: 0; line-height: 1.5; }
  footer { margin-top: 32px; font-size: 11px; color: #8a8278; text-align: center; }
  @media print { body { margin: 0; padding: 16px; } .recipe { page-break-inside: avoid; } }
</style>
</head>
<body>
  ${logoHtml ? `<div class="brand">${logoHtml}<h1 style="margin:0">Recetario</h1></div>` : `<h1>Recetario</h1>`}
  <p class="sub">${esc(nutricionistaName)} — generado el ${esc(today)}</p>
  ${recipesHtml}
  <footer>NutriFit</footer>
</body>
</html>`

  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
