import { describe, it, expect } from 'vitest'
import {
  PlanPhase, addDays, daysBetween, formatRange, isISODate, madridDay, nextPhaseDefaults, PHASE_PRESETS, applyPhasePreset, phaseDigestNotes, phaseReview, phaseStatus, summarizePhases, validatePhase,
} from './planPhases'

const phase = (id: string, name: string, startDate: string, endDate: string): PlanPhase =>
  ({ id, clientId: 'c1', name, description: '', startDate, endDate, templateId: null })

const P1 = phase('1', 'Definición', '2026-11-02', '2026-11-29')
const P2 = phase('2', 'Mantenimiento', '2026-11-30', '2026-12-13')

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isISODate('2026-11-04')).toBe(true)
    expect(isISODate('2026-02-31')).toBe(false)
    expect(isISODate('04/11/2026')).toBe(false)
    expect(isISODate('')).toBe(false)
  })
  it('counts and adds days without time zone surprises', () => {
    expect(daysBetween('2026-11-04', '2026-11-07')).toBe(3)
    expect(daysBetween('2026-11-07', '2026-11-04')).toBe(-3)
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1) // cambio de hora de octubre
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('phaseStatus', () => {
  it('is upcoming, active (both ends included) or ended', () => {
    expect(phaseStatus(P1, '2026-11-01')).toBe('upcoming')
    expect(phaseStatus(P1, '2026-11-02')).toBe('active')
    expect(phaseStatus(P1, '2026-11-29')).toBe('active')
    expect(phaseStatus(P1, '2026-11-30')).toBe('ended')
  })
})

describe('validatePhase', () => {
  it('accepts a good phase', () => {
    expect(validatePhase({ name: 'Volumen', startDate: '2026-12-14', endDate: '2027-01-10' }, [P1, P2])).toEqual([])
  })
  it('asks for a name and valid dates', () => {
    expect(validatePhase({ name: '  ', startDate: '2026-12-14', endDate: '2027-01-10' }, [])).toHaveLength(1)
    expect(validatePhase({ name: 'x', startDate: 'mañana', endDate: '2027-01-10' }, [])).toEqual(['La fecha de inicio no es válida.'])
  })
  it('rejects a phase that ends before it starts', () => {
    expect(validatePhase({ name: 'x', startDate: '2026-12-14', endDate: '2026-12-01' }, [])).toEqual(['La fase no puede acabar antes de empezar.'])
  })
  it('rejects an overlap but allows back-to-back phases and one-day phases', () => {
    expect(validatePhase({ name: 'x', startDate: '2026-11-20', endDate: '2026-12-05' }, [P1, P2])[0]).toContain('Definición')
    expect(validatePhase({ name: 'x', startDate: '2026-12-14', endDate: '2026-12-14' }, [P1, P2])).toEqual([])
    expect(validatePhase({ name: 'x', startDate: '2026-11-29', endDate: '2026-11-29' }, [P1])).toHaveLength(1)
  })
})

describe('summarizePhases', () => {
  it('finds the current phase, its position, the days left and the next one', () => {
    const s = summarizePhases([P2, P1], '2026-11-04')
    expect(s.current?.id).toBe('1')
    expect(s.position).toBe(1)
    expect(s.total).toBe(2)
    expect(s.daysLeft).toBe(26)
    expect(s.next?.id).toBe('2')
    expect(s.daysToNext).toBe(26)
  })
  it('counts today as a day left, so the last day shows 1', () => {
    expect(summarizePhases([P1], '2026-11-29').daysLeft).toBe(1)
  })
  it('has no current phase between phases or before the first', () => {
    const gap = summarizePhases([P1, phase('3', 'Volumen', '2026-12-20', '2027-01-10')], '2026-12-05')
    expect(gap.current).toBeNull()
    expect(gap.next?.name).toBe('Volumen')
    expect(gap.daysToNext).toBe(15)
    expect(summarizePhases([], '2026-11-04')).toMatchObject({ current: null, total: 0, next: null })
  })
})

describe('phaseReview', () => {
  it('says nothing while a phase has time left, or with no phases', () => {
    expect(phaseReview([P1, P2], '2026-11-10')).toBeNull()
    expect(phaseReview([], '2026-11-10')).toBeNull()
  })
  it('warns in the last days of a phase and names the next one', () => {
    const r = phaseReview([P1, P2], '2026-11-27')
    expect(r?.kind).toBe('ending')
    expect(r?.text).toBe('La fase «Definición» termina en 3 días. La siguiente es «Mantenimiento».')
    expect(phaseReview([P1, P2], '2026-11-29')?.text).toContain('termina hoy')
  })
  it('warns when the last phase is about to end with nothing after it', () => {
    expect(phaseReview([P2], '2026-12-12')?.text).toBe('La fase «Mantenimiento» termina en 2 días. No hay otra fase después.')
  })
  it('warns for two weeks after the last phase ended, then stops', () => {
    expect(phaseReview([P2], '2026-12-15')).toMatchObject({ kind: 'ended', text: 'La fase «Mantenimiento» terminó hace 2 días y no hay otra después.' })
    expect(phaseReview([P2], '2026-12-27')?.kind).toBe('ended')
    expect(phaseReview([P2], '2026-12-28')).toBeNull()
  })
  it('does not warn about a gap between two phases', () => {
    expect(phaseReview([P1, phase('3', 'Volumen', '2026-12-20', '2027-01-10')], '2026-12-05')).toBeNull()
  })
})

describe('formatting and defaults', () => {
  it('writes a short range', () => {
    expect(formatRange(P1)).toBe('2 nov – 29 nov')
  })
  it('proposes the next phase right after the last one, four weeks long, or from today', () => {
    expect(nextPhaseDefaults([P1, P2], '2026-11-04')).toEqual({ startDate: '2026-12-14', endDate: '2027-01-10' })
    expect(nextPhaseDefaults([], '2026-11-04')).toEqual({ startDate: '2026-11-04', endDate: '2026-12-01' })
    expect(nextPhaseDefaults([P1], '2026-12-20').startDate).toBe('2026-12-20')
  })
})

describe('phaseDigestNotes', () => {
  const entry = (phases: PlanPhase[]) => [{ clientName: 'Ana', phases }]
  it('says nothing on an ordinary day', () => {
    expect(phaseDigestNotes(entry([P1, P2]), '2026-11-10')).toEqual([])
    expect(phaseDigestNotes([], '2026-11-10')).toEqual([])
  })
  it('announces a phase that ends in exactly 3 days, and only that day (no daily repeats)', () => {
    expect(phaseDigestNotes(entry([P1, P2]), '2026-11-27')).toEqual(['Ana: «Definición» termina en 3 días, sigue «Mantenimiento»'])
    expect(phaseDigestNotes(entry([P1, P2]), '2026-11-28')).toEqual([])
    expect(phaseDigestNotes(entry([P2]), '2026-12-11')).toEqual(['Ana: «Mantenimiento» termina en 3 días, no hay otra fase'])
  })
  it('announces the day after the last phase ended, once', () => {
    expect(phaseDigestNotes(entry([P2]), '2026-12-14')).toEqual(['Ana: «Mantenimiento» terminó ayer y no hay otra fase'])
    expect(phaseDigestNotes(entry([P2]), '2026-12-15')).toEqual([])
  })
  it('reports a plan changed today by a phase, in Madrid time', () => {
    const applied = { ...P2, autoApply: true, appliedAt: '2026-11-29T23:30:00Z' } // 00:30 del 30 en Madrid
    expect(madridDay(applied.appliedAt)).toBe('2026-11-30')
    expect(phaseDigestNotes(entry([P1, applied]), '2026-11-30')).toEqual(['Ana: plan cambiado a «Mantenimiento» (automático)'])
    expect(phaseDigestNotes(entry([P1, applied]), '2026-12-01')).toEqual([])
  })
  it('reports a template that could not be applied, for the first three days of the phase only', () => {
    const failed = { ...P2, autoApply: true, appliedAt: null, applyError: 'sin plan' }
    expect(phaseDigestNotes(entry([P1, failed]), '2026-11-30')).toEqual(['Ana: no se pudo aplicar la plantilla de «Mantenimiento»'])
    expect(phaseDigestNotes(entry([P1, failed]), '2026-12-02')).toHaveLength(1)
    expect(phaseDigestNotes(entry([P1, failed]), '2026-12-03')).toEqual([])
  })
})

describe('phase presets', () => {
  it('has the four presets with a name, a description for the client and a duration', () => {
    expect(PHASE_PRESETS.map(p => p.name)).toEqual(['Definición', 'Mantenimiento', 'Pausa de dieta', 'Volumen'])
    for (const p of PHASE_PRESETS) { expect(p.description.length).toBeGreaterThan(20); expect(p.weeks).toBeGreaterThan(0) }
  })
  it('a diet break is short (one or two weeks)', () => {
    expect(PHASE_PRESETS.find(p => p.id === 'pausa')!.weeks).toBeLessThanOrEqual(2)
  })
  it('fills name, description and the last day (inclusive) from the start date', () => {
    const preset = PHASE_PRESETS.find(p => p.id === 'definicion')!
    expect(applyPhasePreset(preset, '2026-11-09')).toEqual({ name: 'Definición', description: preset.description, endDate: '2027-01-03' })
    const pausa = PHASE_PRESETS.find(p => p.id === 'pausa')!
    expect(applyPhasePreset(pausa, '2026-11-09').endDate).toBe('2026-11-22')
  })
  it('every preset passes the same validation as a hand-made phase', () => {
    for (const p of PHASE_PRESETS) {
      const filled = applyPhasePreset(p, '2026-11-09')
      expect(validatePhase({ name: filled.name, startDate: '2026-11-09', endDate: filled.endDate }, [])).toEqual([])
    }
  })
})
