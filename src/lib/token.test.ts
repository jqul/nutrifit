import { describe, it, expect } from 'vitest'
import { generateClientToken } from './token'

describe('generateClientToken', () => {
  it('returns 32 lowercase hex characters (128 bits)', () => {
    expect(generateClientToken()).toMatch(/^[0-9a-f]{32}$/)
  })

  it('does not repeat across many calls', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateClientToken()))
    expect(tokens.size).toBe(1000)
  })
})
