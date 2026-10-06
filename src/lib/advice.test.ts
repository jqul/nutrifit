import { describe, it, expect } from 'vitest'
import { ADVICE_COLLAPSE_CHARS, adviceNeedsCollapse } from './advice'

describe('adviceNeedsCollapse', () => {
  it('leaves a short one-liner fully visible', () => {
    expect(adviceNeedsCollapse('Bebe 2 L de agua al día.')).toBe(false)
  })
  it('folds a long advice', () => {
    expect(adviceNeedsCollapse('x'.repeat(ADVICE_COLLAPSE_CHARS + 1))).toBe(true)
    expect(adviceNeedsCollapse('x'.repeat(ADVICE_COLLAPSE_CHARS))).toBe(false)
  })
  it('folds one with several paragraphs even if it is short', () => {
    expect(adviceNeedsCollapse('Bebe agua.\nEvita el alcohol.')).toBe(true)
  })
  it('ignores the whitespace around it', () => {
    expect(adviceNeedsCollapse('  corto  \n')).toBe(false)
  })
})
