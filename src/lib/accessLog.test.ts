import { describe, it, expect } from 'vitest'
import { describeAccess, describeAccessSummary, formatAccessTime } from './accessLog'

describe('describeAccess', () => {
  it('says who did what, and to which client when it is not obvious', () => {
    expect(describeAccess({ actor_name: 'Javier', action: 'ficha' }, 'María Torres')).toBe('Javier · Abrió la ficha de María Torres')
    expect(describeAccess({ actor_name: 'Javier', action: 'exportacion' })).toBe('Javier · Exportó los datos')
    expect(describeAccess({ actor_name: 'Javier', action: 'informe' }, 'Ana')).toBe('Javier · Sacó el informe de Ana')
  })
  it('does not break with no name', () => {
    expect(describeAccess({ actor_name: '  ', action: 'ficha' })).toBe('Alguien de tu cuenta · Abrió la ficha')
  })
})

describe('describeAccessSummary', () => {
  it('says there is nothing when there is nothing', () => {
    expect(describeAccessSummary({ opens: 0, exports: 0, last_at: null }, 'Marta')).toContain('ningún acceso registrado')
    expect(describeAccessSummary({ opens: 0, exports: 0, last_at: '2026-11-05T10:00:00Z' }, 'Marta')).toContain('ningún acceso registrado')
  })
  it('counts opens and exports in plain words, with the singular', () => {
    const one = describeAccessSummary({ opens: 1, exports: 0, last_at: '2026-11-05T10:00:00Z' }, 'Marta')
    expect(one).toBe('En el último año, Marta ha abierto tu ficha una vez. La última vez fue el 5 de noviembre de 2026.')
    const both = describeAccessSummary({ opens: 12, exports: 2, last_at: '2026-11-05T10:00:00Z' }, 'Marta')
    expect(both).toContain('ha abierto tu ficha 12 veces y ha exportado tus datos 2 veces')
  })
})

describe('formatAccessTime', () => {
  it('writes a short date and time', () => {
    expect(formatAccessTime('2026-11-05T09:42:00Z')).toMatch(/^5 nov\.?, \d{2}:\d{2}$/)
  })
})
