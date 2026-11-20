import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClientData } from '../../../../types'
import { MetabolicCalculatorPanel } from './MetabolicCalculatorPanel'
import { PlanSignalList } from '../../../shared/PlanSignalList'
import { evaluatePlanSafety } from '../../../../lib/planSafety'

// Pantalla real de la calculadora (se renderiza el componente), sin navegador. Con el estado inicial (peso vacío) se ven las señales
// que dependen de la ficha: menor de edad, sexo sin informar, embarazo/lactancia. El flujo con cifras (aplicar, confirmar) lo cubren
// las pruebas de la lógica (planSafety, metabolicCalculator) y la comprobación en la demo.
const yearsAgo = (n: number) => `${new Date().getFullYear() - n}-01-15`
const client = (over: Partial<ClientData> = {}) => ({ id: 'c1', name: 'Ana', gender: 'Mujer', birthDate: yearsAgo(35), heightCm: 165, ...over }) as unknown as ClientData
const html = (c: ClientData, reproductiveAnswer?: string) =>
  renderToStaticMarkup(<MetabolicCalculatorPanel client={c} onClose={() => {}} onApply={() => {}} reproductiveAnswer={reproductiveAnswer} />)

describe('MetabolicCalculatorPanel — lo que se ve según la ficha', () => {
  it('menor de edad: lo dice y no hay botón de aplicar', () => {
    const out = html(client({ birthDate: yearsAgo(14) }))
    expect(out).toContain('Menor de 18 años: no se calcula')
    expect(out).toContain('no se derivaron de menores')
    expect(out).not.toContain('Aplicar al plan')
  })
  it('17 años: también menor; 18: ya no', () => {
    expect(html(client({ birthDate: yearsAgo(17) }))).toContain('Menor de 18 años')
    expect(html(client({ birthDate: yearsAgo(18) }))).not.toContain('Menor de 18 años')
  })
  it('sexo: no se asume. Reconocido solo con palabras completas; «F», «No binario» o vacío quedan «Sin indicar» y avisan', () => {
    for (const gender of ['F', 'No binario', '', null]) {
      const out = html(client({ gender: gender as string }))
      expect(out, String(gender)).toContain('Falta el sexo')
      expect(out, String(gender)).toMatch(/<option value="" selected="">Sin indicar<\/option>/)
    }
    const mujer = html(client({ gender: 'Femenino' }))
    expect(mujer).not.toContain('Falta el sexo')
    expect(mujer).toMatch(/<option value="mujer" selected="">Mujer<\/option>/)
    expect(html(client({ gender: 'Hombre' }))).toMatch(/<option value="hombre" selected="">Hombre<\/option>/)
  })
  it('embarazo con el objetivo por defecto (déficit): bloquea el objetivo de pérdida y lo explica', () => {
    const out = html(client(), 'Embarazo')
    expect(out).toContain('En embarazo no se calcula un objetivo de pérdida de peso')
    expect(out).toMatch(/<option value="embarazo" selected="">Embarazo<\/option>/)
    expect(html(client(), 'Lactancia')).toContain('En lactancia no se calcula un objetivo de pérdida de peso')
  })
  it('sin información de embarazo/lactancia: una nota informativa, no un bloqueo; con «No», nada', () => {
    const sin = html(client())
    expect(sin).toContain('No consta si hay embarazo o lactancia')
    expect(sin).not.toContain('no se calcula un objetivo')
    expect(html(client(), 'No (o no aplica)')).not.toContain('No consta si hay embarazo o lactancia')
    // sin depender del sexo de la ficha: el mismo aviso neutro para cualquier adulto
    expect(html(client({ gender: 'Hombre' }))).toContain('No consta si hay embarazo o lactancia (solo si te aplica)')
    expect(html(client({ gender: null as never }))).toContain('No consta si hay embarazo o lactancia (solo si te aplica)')
  })
  it('sin peso rellena el aviso de siempre y no pinta «falta el peso» como error', () => {
    const out = html(client())
    expect(out).toContain('Rellena peso, altura y edad para calcular.')
    expect(out).not.toContain('Falta el peso')
  })
  it('los controles tienen nombre accesible', () => {
    const out = html(client())
    for (const id of ['calc-formula', 'calc-sexo', 'calc-actividad', 'calc-objetivo', 'calc-gestacion']) expect(out).toContain(`for="${id}"`)
    expect(out).toContain('aria-label="Cerrar la calculadora"')
  })
  it('ningún texto de la pantalla promete seguridad', () => {
    for (const c of [client(), client({ birthDate: yearsAgo(14) }), client({ gender: null as never })]) {
      expect(html(c, 'Embarazo')).not.toMatch(/l[ií]mite seguro|es seguro|garantiz|m[ií]nimo seguro/i)
    }
  })
})

describe('PlanSignalList', () => {
  const ev = evaluatePlanSafety({ sex: 'mujer', ageYears: 35, weightKg: 45, heightCm: 160, formula: 'mifflin', losingWeight: true, reproductiveStatus: 'no_consta' }, { kcal: 1000, bmr: 1189, carbsG: 40, remainingKcalForCarbs: 100 })
  it('muestra título, explicación y base de cada señal, con su gravedad en texto', () => {
    const out = renderToStaticMarkup(<PlanSignalList signals={ev.signals} />)
    expect(out).toContain('Por debajo del umbral de revisión (1200 kcal)')
    expect(out).toContain('IMC bajo (17,6)')
    expect(out).toContain('Pide revisión profesional')
    expect(out).toContain('base: decisión de producto')
    expect(out).toContain('base: evidencia limitada')
    expect(out).toContain('aria-label="Señales sobre el cálculo"')
  })
  it('las informativas solo salen si se piden; una lista vacía no pinta nada', () => {
    expect(renderToStaticMarkup(<PlanSignalList signals={ev.signals} />)).not.toContain('No consta si hay embarazo')
    expect(renderToStaticMarkup(<PlanSignalList signals={ev.signals} showInfo />)).toContain('No consta si hay embarazo')
    expect(renderToStaticMarkup(<PlanSignalList signals={[]} />)).toBe('')
  })
})
