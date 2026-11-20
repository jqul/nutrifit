import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClientData } from '../../../../types'
import { ReproductiveCheck } from '../../../../lib/planSafety'
import { MetabolicCalculatorPanel } from './MetabolicCalculatorPanel'

// Qué se ve en la calculadora según el estado de la lectura del cuestionario: cargando, error o leído.
const client = { id: 'c1', name: 'Ana', gender: 'Mujer', birthDate: `${new Date().getFullYear() - 35}-01-15`, heightCm: 165 } as unknown as ClientData
const html = (answer: string | undefined, check: ReproductiveCheck | undefined) =>
  renderToStaticMarkup(<MetabolicCalculatorPanel client={client} onClose={() => {}} onApply={() => {}} reproductiveAnswer={answer} reproductiveCheck={check} />)

describe('MetabolicCalculatorPanel — comprobación del cuestionario', () => {
  it('error de lectura: lo dice claramente y no lo trata como «no hay embarazo»', () => {
    const out = html(undefined, 'error')
    expect(out).toContain('No se ha podido comprobar el embarazo o la lactancia')
    expect(out).toMatch(/NO significa que no haya embarazo ni lactancia/)
    expect(out).not.toContain('No consta si hay embarazo o lactancia (solo si te aplica)')
  })
  it('cargando: avisa de que se está comprobando', () => {
    expect(html(undefined, 'loading')).toContain('Comprobando el cuestionario de salud')
  })
  it('leído: sin aviso de comprobación; si no hay respuesta, la nota neutra de «no consta»', () => {
    const out = html(undefined, 'ready')
    expect(out).not.toContain('No se ha podido comprobar')
    expect(out).not.toContain('Comprobando el cuestionario')
    expect(out).toContain('No consta si hay embarazo o lactancia (solo si te aplica)')
  })
  it('con una respuesta «No», el error de lectura ya no se señala: el estado lo indica la propia respuesta', () => {
    const out = html('No (o no me aplica)', 'error')
    expect(out).not.toContain('No se ha podido comprobar')
  })
  it('con embarazo declarado el aviso de población manda, también si falló la lectura', () => {
    expect(html('Embarazo', 'error')).toContain('En embarazo no se calcula un objetivo de pérdida de peso')
  })
  it('declarado por el cliente frente a seleccionado por el profesional: el selector parte de la respuesta y se puede cambiar a mano', () => {
    const out = html('Lactancia', 'ready')
    expect(out).toMatch(/<option value="lactancia" selected="">Lactancia<\/option>/)
    expect(out).toContain('id="calc-gestacion"')
  })
})
