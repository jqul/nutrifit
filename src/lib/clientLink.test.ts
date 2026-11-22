import { describe, it, expect } from 'vitest'
import { interpretClaim, invitationProblem, invitationUrl, parseInvitationCreated, interpretManagement } from './clientLink'

describe('interpretClaim: el éxito solo se declara con un resultado explícito de éxito', () => {
  it('«linked» y «already_linked» son éxito; «pending_approval» es solicitud enviada, no acceso', () => {
    expect(interpretClaim({ result: 'linked' }, null).kind).toBe('linked')
    expect(interpretClaim({ result: 'already_linked' }, null).kind).toBe('linked')
    const p = interpretClaim({ result: 'pending_approval' }, null)
    expect(p.kind).toBe('pending_approval'); expect(p.message).toMatch(/aprobar/)
  })
  it('un error de la RPC, una respuesta vacía (la antigua función void), nula, un texto o un resultado desconocido son FALLO (nunca «todo listo»)', () => {
    for (const [data, error] of [[null, { message: 'boom' }], [null, null], [undefined, null], ['', null], ['linked', null], [{}, null], [{ result: 'otro' }, null], [{ result: 'linked' }, new Error('x')]] as const)
      expect(interpretClaim(data, error).kind, JSON.stringify([data, error])).toBe('failed')
  })
  it('sin email confirmado se pide confirmarlo (y no es éxito ni error de la cuenta)', () => {
    expect(interpretClaim({ result: 'email_not_confirmed' }, null).kind).toBe('need_email_confirmation')
  })
  it('cada resultado de rechazo tiene un mensaje propio y accionable', () => {
    const codigos = ['email_mismatch', 'account_not_allowed', 'invitation_expired', 'invitation_used', 'invitation_revoked', 'invitation_invalid', 'ficha_already_linked', 'pending_exists']
    const mensajes = new Set<string>()
    for (const c of codigos) { const o = interpretClaim({ result: c }, null); expect(o.kind, c).toBe('failed'); expect(o.code).toBe(c); expect(o.message.length).toBeGreaterThan(20); mensajes.add(o.message) }
    expect(mensajes.size).toBe(codigos.length)
  })
  it('los mensajes no revelan datos de la ficha ni emails', () => {
    for (const c of ['email_mismatch', 'ficha_already_linked']) expect(interpretClaim({ result: c }, null).message).not.toMatch(/@|uid|token/i)
  })
})

describe('invitationProblem / invitationUrl / parseInvitationCreated / interpretManagement', () => {
  it('solo «valid» deja continuar; el resto explica el problema (también un estado desconocido)', () => {
    expect(invitationProblem('valid')).toBeNull()
    for (const s of ['expired', 'used', 'revoked', 'ficha_already_linked', 'invalid', 'loquesea', null, undefined]) expect(invitationProblem(s as string)?.message.length, String(s)).toBeGreaterThan(10)
    expect(invitationProblem('expired')?.message).toMatch(/24 horas/)
  })
  it('el enlace usa ?i= y escapa el token', () => {
    expect(invitationUrl('https://app.example', 'abc123')).toBe('https://app.example/?i=abc123')
    expect(invitationUrl('https://app.example', 'a b')).toBe('https://app.example/?i=a%20b')
  })
  it('create_client_invitation: solo se acepta con token largo y caducidad', () => {
    expect(parseInvitationCreated({ token: 'a'.repeat(64), expires_at: '2026-11-22T10:00:00Z', invitation_id: 'x' })).toEqual({ token: 'a'.repeat(64), expiresAt: '2026-11-22T10:00:00Z' })
    for (const mal of [null, {}, { token: 'corto', expires_at: 'x' }, { token: 'a'.repeat(64) }, 'texto']) expect(parseInvitationCreated(mal)).toBeNull()
  })
  it('interpretManagement: éxito solo con el resultado esperado; errores y resultados raros son fallo con mensaje', () => {
    expect(interpretManagement({ result: 'unlinked' }, null, ['unlinked'])).toEqual({ ok: true, message: 'unlinked' })
    expect(interpretManagement({ result: 'not_linked' }, null, ['unlinked']).ok).toBe(false)
    expect(interpretManagement({ result: 'already_decided' }, null, ['linked']).message).toMatch(/resuelta/)
    expect(interpretManagement(null, { message: 'No autorizado' }, ['linked'])).toEqual({ ok: false, message: 'No autorizado' })
    expect(interpretManagement(null, null, ['linked']).ok).toBe(false)
  })
})

import { eventLabel } from './clientLink'
describe('eventLabel', () => {
  it('cada evento tiene un texto legible y ninguno incluye emails, uids ni tokens', () => {
    for (const [e, m] of [['invitation_created', 'enlace_24h'], ['invitation_revoked', 'enlace_regenerado'], ['invitation_revoked', 'desvinculacion'], ['link_requested', 'x'], ['link_rejected', 'x'], ['claim_denied', 'x'], ['unlinked', 'desvinculacion_profesional'], ['unlinked', 'ficha_eliminada'], ['reassigned', 'x'], ['linked', 'email_verificado'], ['linked', 'aprobacion_profesional'], ['linked', 'modo_personal'], ['linked', 'migracion_inicial'], ['linked', 'cambio_directo']]) {
      const t = eventLabel(e, m); expect(t.length, e + '/' + m).toBeGreaterThan(8); expect(t).not.toMatch(/@|uid|token/i)
    }
  })
})

import { consentStatus } from './clientLink'
describe('consentStatus', () => {
  it('sin firma, vigente, y cuestionado hasta que haya una firma posterior a la marca (el original no se toca)', () => {
    expect(consentStatus({ consentAcceptedAt: null })).toBe('sin_firmar')
    expect(consentStatus({ consentAcceptedAt: '2026-11-01T10:00:00Z' })).toBe('vigente')
    expect(consentStatus({ consentAcceptedAt: '2026-11-01T10:00:00Z', consentInvalidatedAt: '2026-11-02T10:00:00Z' })).toBe('cuestionado')
    expect(consentStatus({ consentAcceptedAt: '2026-11-02T10:00:00Z', consentInvalidatedAt: '2026-11-02T10:00:00Z' })).toBe('cuestionado')
    expect(consentStatus({ consentAcceptedAt: '2026-11-03T10:00:00Z', consentInvalidatedAt: '2026-11-02T10:00:00Z' })).toBe('vigente')
  })
  it('too_many_attempts es un fallo con mensaje propio', () => {
    expect(interpretClaim({ result: 'too_many_attempts' }, null)).toMatchObject({ kind: 'failed', code: 'too_many_attempts' })
  })
})
