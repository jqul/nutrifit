import { describe, it, expect } from 'vitest'
import { FALLBACK_ANON_KEY, FALLBACK_URL, resolveSupabaseConfig } from './supabaseConfig'

const OTHER_URL = 'https://otroproyecto.supabase.co'
const OTHER_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma_de_prueba-123'

describe('resolveSupabaseConfig', () => {
  it('uses the environment and stays silent when both values are valid', () => {
    const c = resolveSupabaseConfig(OTHER_URL, OTHER_KEY)
    expect(c).toEqual({ url: OTHER_URL, key: OTHER_KEY, warnings: [] })
  })

  it('falls back and says so when both variables are missing', () => {
    const c = resolveSupabaseConfig(undefined, undefined)
    expect(c.url).toBe(FALLBACK_URL)
    expect(c.key).toBe(FALLBACK_ANON_KEY)
    expect(c.warnings).toEqual(['falta VITE_SUPABASE_URL', 'falta VITE_SUPABASE_ANON_KEY'])
  })

  it('ignores a masked or truncated key (the Vercel case) and flags it', () => {
    const c = resolveSupabaseConfig(FALLBACK_URL, '••••••••••••')
    expect(c.key).toBe(FALLBACK_ANON_KEY)
    expect(c.warnings).toHaveLength(1)
    expect(c.warnings[0]).toContain('no tiene forma de JWT')
  })

  it('ignores a non-https URL', () => {
    const c = resolveSupabaseConfig('http://localhost:54321', OTHER_KEY)
    expect(c.url).toBe(FALLBACK_URL)
    expect(c.warnings[0]).toContain('no es una URL https válida')
  })

  it('warns about a possible project mismatch when only one value comes from the environment', () => {
    const urlOnly = resolveSupabaseConfig(OTHER_URL, undefined)
    expect(urlOnly.warnings.some(w => w.includes('proyectos distintos'))).toBe(true)
    const keyOnly = resolveSupabaseConfig(undefined, OTHER_KEY)
    expect(keyOnly.warnings.some(w => w.includes('proyectos distintos'))).toBe(true)
  })

  it('does not call it a mismatch when the environment value is the fallback project itself', () => {
    const c = resolveSupabaseConfig(FALLBACK_URL, undefined)
    expect(c.warnings).toEqual(['falta VITE_SUPABASE_ANON_KEY'])
  })

  it('never puts a key in a warning', () => {
    for (const c of [resolveSupabaseConfig(undefined, undefined), resolveSupabaseConfig(OTHER_URL, 'eyJbroken'), resolveSupabaseConfig(undefined, OTHER_KEY)]) {
      expect(c.warnings.join(' ')).not.toMatch(/eyJ[\w-]{10,}/)
    }
  })
})
