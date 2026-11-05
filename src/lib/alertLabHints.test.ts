import { describe, it, expect } from 'vitest'
import { labHintsForAlerts } from './alertLabHints'
import { BloodMarkerRow } from './supabase-types'

const TODAY = '2026-11-05'
const m = (marker_key: string, value: number, date: string): BloodMarkerRow => ({ id: `${marker_key}${date}`, client_id: 'c1', date, marker_key, value, created_at: '' })

describe('labHintsForAlerts', () => {
  it('says nothing for alerts that have no related marker, or for no alerts', () => {
    expect(labHintsForAlerts([], [m('hierro', 30, '2026-10-01')], TODAY)).toEqual([])
    expect(labHintsForAlerts([{ kind: 'low_adherence' }, { kind: 'no_weigh_in' }, { kind: 'goal_reached' }], [], TODAY)).toEqual([])
  })

  it('links low energy to an out-of-range iron, with its age and a prudent wording', () => {
    const [h] = labHintsForAlerts([{ kind: 'low_energy' }], [m('hierro', 40, '2026-09-05'), m('vitamina_d', 45, '2026-09-05'), m('tsh', 2, '2026-09-05')], TODAY)
    expect(h.tone).toBe('related')
    expect(h.text).toBe('Con la energía baja: hierro bajo (hace 2 meses). Puede estar relacionado.')
  })

  it('names several out-of-range markers and what is still missing', () => {
    const [h] = labHintsForAlerts([{ kind: 'low_energy' }], [m('hierro', 40, '2026-10-20'), m('vitamina_d', 12, '2026-10-20')], TODAY)
    expect(h.text).toBe('Con la energía baja: hierro bajo (hace 16 días) y vitamina D bajo (hace 16 días). Puede estar relacionado. Falta una analítica reciente de TSH.')
  })

  it('suggests asking for a lab when nothing recent is on file', () => {
    const [h] = labHintsForAlerts([{ kind: 'low_energy' }], [], TODAY)
    expect(h.tone).toBe('missing')
    expect(h.text).toBe('Con la energía baja no hay analítica reciente de hierro, vitamina D y TSH: puede merecer la pena pedirla.')
  })

  it('treats a lab older than a year as missing', () => {
    expect(labHintsForAlerts([{ kind: 'high_hunger' }], [m('glucosa', 120, '2025-10-01')], TODAY)[0].tone).toBe('missing')
    expect(labHintsForAlerts([{ kind: 'high_hunger' }], [m('glucosa', 120, '2025-11-10')], TODAY)[0].tone).toBe('related')
  })

  it('reassures only when every related marker is recent and in range', () => {
    const [h] = labHintsForAlerts([{ kind: 'weight_stalled' }], [m('tsh', 2, '2026-10-01'), m('glucosa', 85, '2026-10-01')], TODAY)
    expect(h.tone).toBe('ok')
    expect(h.text).toBe('Con el peso parado: TSH y glucosa en rango en su última analítica, así que quizá no vaya por ahí.')
  })

  it('uses only the latest reading of each marker', () => {
    const [h] = labHintsForAlerts([{ kind: 'high_hunger' }], [m('glucosa', 130, '2026-08-01'), m('glucosa', 88, '2026-10-30')], TODAY)
    expect(h.tone).toBe('ok')
  })

  it('gives one hint per alert kind, in the order of the alerts', () => {
    const hints = labHintsForAlerts([{ kind: 'high_hunger' }, { kind: 'low_energy' }, { kind: 'high_hunger' }], [], TODAY)
    expect(hints.map(h => h.kind)).toEqual(['high_hunger', 'low_energy'])
  })
})
