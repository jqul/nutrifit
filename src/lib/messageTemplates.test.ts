import { describe, it, expect } from 'vitest'
import { resolveMessage } from './messageTemplates'

describe('resolveMessage', () => {
  it('replaces the {{cliente}} placeholder with the client name', () => {
    expect(resolveMessage('Hola {{cliente}} 👋', 'María')).toBe('Hola María 👋')
  })

  it('replaces multiple occurrences', () => {
    expect(resolveMessage('{{cliente}}, hola {{cliente}}', 'Carlos')).toBe('Carlos, hola Carlos')
  })

  it('is case-insensitive and tolerates spaces inside the braces', () => {
    expect(resolveMessage('Hola {{ Cliente }}', 'Laura')).toBe('Hola Laura')
  })

  it('leaves text without a placeholder unchanged', () => {
    expect(resolveMessage('Mensaje fijo sin variables', 'Ana')).toBe('Mensaje fijo sin variables')
  })
})
