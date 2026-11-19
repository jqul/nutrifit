import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CONFIRMATION_TEXT, ProfessionalConfirmation } from './ProfessionalConfirmation'

// Los ficheros que usan la casilla, leídos como texto, para comprobar que la confirmación NO se persiste.
const fuentes = import.meta.glob(
  ['../trainer/client-panel/PlanDietaTab.tsx', '../trainer/client-panel/DietAdjustmentCard.tsx', '../trainer/client-panel/PlanVersions.tsx', '../trainer/client-panel/plan-dieta/MetabolicCalculatorPanel.tsx', '../trainer/client-panel/plan-dieta/planModel.ts'],
  { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const src = (name: string) => Object.entries(fuentes).find(([k]) => k.endsWith(name))![1]

describe('ProfessionalConfirmation: confirmación visual no auditada', () => {
  it('el texto dice expresamente que es visual y no auditada, y no promete trazabilidad ni registro', () => {
    expect(CONFIRMATION_TEXT).toMatch(/Confirmación visual en pantalla, no auditada/)
    expect(CONFIRMATION_TEXT).toMatch(/la app no guarda que la hayas marcado/)
    expect(CONFIRMATION_TEXT).not.toMatch(/trazab|queda registrad|se registra|historial|validaci[oó]n profesional auditada/i)
  })
  it('se pinta como una casilla con su etiqueta asociada (nombre accesible), marcada o no', () => {
    const off = renderToStaticMarkup(<ProfessionalConfirmation checked={false} onChange={() => {}} />)
    const on = renderToStaticMarkup(<ProfessionalConfirmation checked onChange={() => {}} />)
    expect(off).toMatch(/<label for="[^"]+"/)
    expect(off).toMatch(/<input id="[^"]+" type="checkbox"/)
    expect(off).not.toContain('checked')
    expect(on).toContain('checked')
    expect(off).toContain('no auditada')
  })
})

describe('la confirmación no se persiste (solo vive en el estado de la pantalla)', () => {
  const consumidores = ['PlanDietaTab.tsx', 'DietAdjustmentCard.tsx', 'PlanVersions.tsx', 'MetabolicCalculatorPanel.tsx']
  it.each(consumidores)('%s usa la casilla honesta y no la guarda en ningún sitio', name => {
    const t = src(name)
    expect(t).toContain('ProfessionalConfirmation')
    expect(t).not.toMatch(/plan_reviews/)
    // (DietAdjustmentCard ya guardaba en localStorage qué propuesta se descartó; nada de eso toca la confirmación)
    for (const linea of t.split(String.fromCharCode(10)).filter(l => /localStorage|sessionStorage/.test(l))) expect(linea).not.toMatch(/confirm/i)
    // el estado de confirmación nunca viaja a una llamada de Supabase
    for (const estado of ['confirmedPrint', 'confirmedFor', 'restoreConfirmed', 'confirmed']) {
      expect(t, `${name}: ${estado} en una llamada a supabase`).not.toMatch(new RegExp(`supabase[^\\n]*${estado}`))
    }
  })
  it('change_reason NO sustituye a un registro de la confirmación: lo escribe el profesional a mano y no sale del estado de confirmación', () => {
    const plan = src('PlanDietaTab.tsx')
    const llamada = plan.slice(plan.indexOf('buildSavePlanPayload('), plan.indexOf('buildSavePlanPayload(') + 200)
    expect(llamada).toContain('changeReason')
    expect(llamada).not.toMatch(/confirm|signals|evaluation/i)
    expect(src('planModel.ts')).not.toMatch(/confirm|signals|evaluation/i)
    // el reajuste sigue escribiendo solo su propio motivo de historial
    expect(src('DietAdjustmentCard.tsx')).toMatch(/change_reason: result\.historyReason/)
  })
})
