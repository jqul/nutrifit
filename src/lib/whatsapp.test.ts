import { describe, it, expect } from 'vitest'
import { buildWAUrl } from './whatsapp'

describe('buildWAUrl', () => {
  it('strips non-digit characters from the phone number', () => {
    expect(buildWAUrl('+34 600 111 222', 'Hola')).toBe('https://wa.me/34600111222?text=Hola')
  })

  it('url-encodes the message text', () => {
    expect(buildWAUrl('600111222', 'Hola María 👋')).toBe(`https://wa.me/600111222?text=${encodeURIComponent('Hola María 👋')}`)
  })

  it('falls back to a contact-picker link when there is no phone', () => {
    expect(buildWAUrl('', 'Hola')).toBe('https://wa.me/?text=Hola')
  })
})
