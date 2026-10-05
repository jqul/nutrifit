import { describe, it, expect } from 'vitest'
import { formatNotesEdited } from './notesMeta'

describe('formatNotesEdited', () => {
  it('shows date and time of the last edit', () => {
    const t = new Date('2026-10-03T18:40:00').getTime()
    const s = formatNotesEdited(t, true)
    expect(s).toMatch(/^Última edición: /)
    expect(s).toContain('2026')
    expect(s).toContain('18:40')
  })

  it('explains the missing date when there are notes without a timestamp', () => {
    expect(formatNotesEdited(null, true)).toBe('Última edición: sin fecha registrada')
    expect(formatNotesEdited(undefined, true)).toBe('Última edición: sin fecha registrada')
  })

  it('says nothing was written yet when there are no notes', () => {
    expect(formatNotesEdited(null, false)).toBe('Todavía no has escrito ninguna nota')
  })
})
