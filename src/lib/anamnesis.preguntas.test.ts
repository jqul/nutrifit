import { describe, it, expect } from 'vitest'
import { leerPreguntasPersonalizadas } from './anamnesis'

describe('leerPreguntasPersonalizadas: un fallo nunca se confunde con «no hay preguntas»', () => {
  it('una lista (también vacía) es una lectura correcta', () => {
    expect(leerPreguntasPersonalizadas([], null)).toEqual({ ok: true, preguntas: [] })
    expect(leerPreguntasPersonalizadas([{ id: 'q1', label: '¿Algo?' }], null)).toEqual({ ok: true, preguntas: [{ id: 'q1', label: '¿Algo?' }] })
  })
  it('un error de la RPC es un fallo, aunque llegue también un dato', () => {
    expect(leerPreguntasPersonalizadas(null, { message: 'Sin acceso' })).toEqual({ ok: false })
    expect(leerPreguntasPersonalizadas([], { message: 'x' })).toEqual({ ok: false })
  })
  it('una respuesta que no es una lista (null, objeto, texto) es un fallo, no «sin preguntas»', () => {
    for (const raro of [null, undefined, {}, 'x', 3]) expect(leerPreguntasPersonalizadas(raro, null)).toEqual({ ok: false })
  })
})
