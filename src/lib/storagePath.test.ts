import { describe, it, expect } from 'vitest'
import { extractObjectPath } from './storagePath'

describe('extractObjectPath', () => {
  it('extracts the object path from a public Supabase Storage URL', () => {
    const url = 'https://yuhebegybxjrdmkpwjqa.supabase.co/storage/v1/object/public/photos/client-1/meals/123.jpg'
    expect(extractObjectPath(url, 'photos')).toBe('client-1/meals/123.jpg')
  })

  it('returns null for a URL from a different bucket', () => {
    const url = 'https://yuhebegybxjrdmkpwjqa.supabase.co/storage/v1/object/public/recipe-photos/abc.jpg'
    expect(extractObjectPath(url, 'photos')).toBeNull()
  })

  it('returns null for a URL that is not a Supabase Storage URL at all', () => {
    expect(extractObjectPath('https://example.com/some/image.jpg', 'photos')).toBeNull()
  })

  it('decodes URL-encoded characters in the path', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/photos/client%201/foto%20final.jpg'
    expect(extractObjectPath(url, 'photos')).toBe('client 1/foto final.jpg')
  })

  it('falls back to the raw (undecoded) slice if decoding fails', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/photos/bad%.jpg'
    expect(extractObjectPath(url, 'photos')).toBe('bad%.jpg')
  })
})
