import { describe, it, expect } from 'vitest'
import { BLOOD_MARKER_MAP, evaluateMarker, adviceForMarker } from './bloodMarkers'

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
