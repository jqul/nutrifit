import { describe, it, expect } from 'vitest'
import { BLOOD_MARKER_MAP, evaluateMarker, adviceForMarker, hasAnyMarkerOutOfRange } from './bloodMarkers'

describe('evaluateMarker', () => {
  it('flags a value below the reference range as "bajo"', () => {
    const glucosa = BLOOD_MARKER_MAP.glucosa
    expect(evaluateMarker(glucosa, 60)).toBe('bajo')
  })

  it('flags a value above the reference range as "alto"', () => {
    const glucosa = BLOOD_MARKER_MAP.glucosa
    expect(evaluateMarker(glucosa, 130)).toBe('alto')
  })

  it('reports "normal" for a value within range', () => {
    const glucosa = BLOOD_MARKER_MAP.glucosa
    expect(evaluateMarker(glucosa, 85)).toBe('normal')
  })
})

describe('adviceForMarker', () => {
  it('returns the high-side advice for an out-of-range-high value', () => {
    const got = BLOOD_MARKER_MAP.got_ast
    expect(adviceForMarker(got, 80)).toContain('Transaminasas')
  })

  it('returns an empty string for a value within range', () => {
    const got = BLOOD_MARKER_MAP.got_ast
    expect(adviceForMarker(got, 20)).toBe('')
  })

  it('returns an empty string when the out-of-range side has no advice defined (e.g. low cholesterol)', () => {
    const colesterol = BLOOD_MARKER_MAP.colesterol_total
    expect(adviceForMarker(colesterol, 100)).toBe('')
  })
})

describe('hasAnyMarkerOutOfRange', () => {
  it('returns false when every marker\'s latest reading is within range', () => {
    const rows = [
      { date: '2026-01-01', marker_key: 'glucosa', value: 85 },
      { date: '2026-01-01', marker_key: 'hdl', value: 55 },
    ]
    expect(hasAnyMarkerOutOfRange(rows)).toBe(false)
  })

  it('returns true when a marker\'s latest reading is out of range', () => {
    const rows = [{ date: '2026-01-01', marker_key: 'glucosa', value: 130 }]
    expect(hasAnyMarkerOutOfRange(rows)).toBe(true)
  })

  it('only looks at the most recent reading per marker, ignoring an old out-of-range value', () => {
    const rows = [
      { date: '2026-01-01', marker_key: 'glucosa', value: 130 }, // vieja, fuera de rango
      { date: '2026-02-01', marker_key: 'glucosa', value: 85 },  // más reciente, normal
    ]
    expect(hasAnyMarkerOutOfRange(rows)).toBe(false)
  })

  it('ignores marker keys not present in BLOOD_MARKERS instead of throwing', () => {
    const rows = [{ date: '2026-01-01', marker_key: 'marcador_desconocido', value: 999 }]
    expect(hasAnyMarkerOutOfRange(rows)).toBe(false)
  })

  it('returns false for an empty list', () => {
    expect(hasAnyMarkerOutOfRange([])).toBe(false)
  })
})
