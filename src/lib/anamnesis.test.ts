import { describe, it, expect } from 'vitest'
import { ANAMNESIS_QUESTIONS } from './anamnesis'
import { reproductiveStatusFromAnswer } from './planSafety'

describe('cuestionario de salud: embarazo y lactancia', () => {
  const q = ANAMNESIS_QUESTIONS.find(x => x.key === 'embarazo_lactancia')

  it('existe como pregunta cerrada (opciones fijas), no como texto libre', () => {
    expect(q).toBeDefined()
    expect(q!.type).toBe('select')
    expect(q!.options).toEqual(['No (o no aplica)', 'Embarazo', 'Lactancia', 'Prefiero comentarlo con mi profesional'])
  })
  it('cada opción se interpreta de forma inequívoca para la calculadora', () => {
    const esperado = ['ninguno', 'embarazo', 'lactancia', 'no_consta']
    expect(q!.options!.map(reproductiveStatusFromAnswer)).toEqual(esperado)
  })
  it('las claves del cuestionario siguen siendo únicas y las anteriores no han cambiado', () => {
    const keys = ANAMNESIS_QUESTIONS.map(x => x.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of ['motivo', 'condiciones', 'medicacion', 'cirugias', 'actividad', 'sueno', 'agua', 'dietas_previas', 'habitos']) expect(keys).toContain(k)
  })
})
