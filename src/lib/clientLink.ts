// Vinculación de una clienta con su ficha (migraciones 0077-0079). Todo lo que la pantalla muestra sobre una reclamación sale de aquí:
// el éxito se declara SOLO cuando la base devuelve un resultado explícito de éxito; un error, un valor vacío (la antigua función void) o un
// resultado desconocido cuentan siempre como fallo.

export type ClaimKind = 'linked' | 'pending_approval' | 'need_email_confirmation' | 'failed'
export interface ClaimOutcome { kind: ClaimKind; code: string; title: string; message: string }

const FAIL = (code: string, message: string, title = 'No se ha podido vincular tu cuenta'): ClaimOutcome => ({ kind: 'failed', code, title, message })

/** Interpreta la respuesta de claim_client_with_invitation. Nunca devuelve éxito si no hay un `result` de éxito explícito. */
export function interpretClaim(data: unknown, error: unknown): ClaimOutcome {
  if (error) return FAIL('rpc_error', 'Ha habido un problema al vincular tu cuenta. Inténtalo de nuevo y, si sigue igual, avisa a tu profesional.')
  const result = data && typeof data === 'object' ? (data as Record<string, unknown>).result : undefined
  switch (result) {
    case 'linked':
    case 'already_linked':
      return { kind: 'linked', code: String(result), title: '¡Cuenta vinculada!', message: 'Ya puedes entrar a tu app.' }
    case 'pending_approval':
      return { kind: 'pending_approval', code: 'pending_approval', title: 'Solicitud enviada',
        message: 'Tu profesional tiene que aprobar tu acceso. Cuando lo haga, entra de nuevo con tu email y tu contraseña.' }
    case 'email_not_confirmed':
      return { kind: 'need_email_confirmation', code: 'email_not_confirmed', title: 'Confirma tu email',
        message: 'Te hemos enviado un email para confirmar tu dirección. Ábrelo, pulsa el enlace y vuelve a abrir este enlace de acceso.' }
    case 'email_mismatch':
      return FAIL('email_mismatch', 'El email de tu cuenta no coincide con el que tu profesional tiene en tu ficha. Usa ese mismo email o pídele que lo corrija.')
    case 'account_not_allowed':
      return FAIL('account_not_allowed', 'Esta cuenta no puede vincularse a una ficha de cliente. Usa otro email para crear tu cuenta.')
    case 'invitation_expired':
      return FAIL('invitation_expired', 'Este enlace ha caducado (valen 24 horas). Pide a tu profesional uno nuevo.', 'Enlace caducado')
    case 'invitation_used':
      return FAIL('invitation_used', 'Este enlace ya se ha usado. Si eres tú, entra con tu email y tu contraseña; si no, pide uno nuevo a tu profesional.', 'Enlace ya usado')
    case 'invitation_revoked':
      return FAIL('invitation_revoked', 'Tu profesional ha generado un enlace más reciente y este ya no vale. Usa el último que te mandó.', 'Enlace anulado')
    case 'invitation_invalid':
      return FAIL('invitation_invalid', 'Este enlace no es válido. Pide uno nuevo a tu profesional.', 'Enlace no válido')
    case 'ficha_already_linked':
      return FAIL('ficha_already_linked', 'Esta ficha ya está vinculada a otra cuenta. Avisa a tu profesional.')
    case 'too_many_attempts':
      return FAIL('too_many_attempts', 'Has hecho demasiados intentos seguidos. Espera una hora e inténtalo de nuevo con el enlace correcto, o pide uno nuevo a tu profesional.', 'Demasiados intentos')
    case 'pending_exists':
      return FAIL('pending_exists', 'Ya hay una solicitud de acceso pendiente para esta ficha. Tu profesional debe resolverla antes.', 'Solicitud pendiente')
    default:
      return FAIL('unknown', 'No hemos podido confirmar la vinculación, así que no se ha hecho. Inténtalo de nuevo o avisa a tu profesional.')
  }
}

/** Estado de la invitación (get_invitation_status) → texto para quien abre un enlace que no sirve. `null` = válida. */
export function invitationProblem(status: string | null | undefined): { title: string; message: string } | null {
  switch (status) {
    case 'valid': return null
    case 'expired': return { title: 'Enlace caducado', message: 'Este enlace ha caducado (valen 24 horas). Pide a tu profesional uno nuevo.' }
    case 'used': return { title: 'Enlace ya usado', message: 'Este enlace ya se ha usado. Si ya creaste tu cuenta, entra con tu email y tu contraseña.' }
    case 'revoked': return { title: 'Enlace anulado', message: 'Tu profesional ha generado uno más reciente. Usa el último que te mandó.' }
    case 'ficha_already_linked': return { title: 'Ficha ya vinculada', message: 'Esta ficha ya tiene una cuenta. Entra con tu email y tu contraseña.' }
    default: return { title: 'Enlace no válido', message: 'Este enlace no es válido. Pide uno nuevo a tu profesional.' }
  }
}

/** Enlace de acceso para la clienta (el token solo existe en este momento: no se puede recuperar después). */
export const invitationUrl = (origin: string, token: string) => `${origin}/?i=${encodeURIComponent(token)}`

/** Interpreta la respuesta de create_client_invitation. */
export function parseInvitationCreated(data: unknown): { token: string; expiresAt: string } | null {
  if (!data || typeof data !== 'object') return null
  const { token, expires_at } = data as Record<string, unknown>
  return typeof token === 'string' && token.length >= 32 && typeof expires_at === 'string' ? { token, expiresAt: expires_at } : null
}

/** Resultado de unlink / approve / reject → éxito explícito o mensaje. */
export function interpretManagement(data: unknown, error: unknown, okResults: string[]): { ok: boolean; message: string } {
  if (error) return { ok: false, message: error instanceof Error ? error.message : (typeof (error as { message?: unknown }).message === 'string' ? String((error as { message: string }).message) : 'No se ha podido completar la acción') }
  const result = data && typeof data === 'object' ? String((data as Record<string, unknown>).result) : ''
  if (okResults.includes(result)) return { ok: true, message: result }
  const razones: Record<string, string> = {
    already_decided: 'Esa solicitud ya estaba resuelta.', request_expired: 'La solicitud había caducado (7 días). Genera un enlace nuevo.',
    ficha_already_linked: 'La ficha ya estaba vinculada.', requester_not_found: 'La cuenta que la solicitó ya no existe.',
    email_not_confirmed: 'La cuenta que la solicitó ya no tiene el email confirmado.', not_linked: 'La ficha no tenía ninguna cuenta vinculada.',
  }
  return { ok: false, message: razones[result] ?? 'No se ha podido completar la acción' }
}

/** Texto de un evento del registro de vinculación para el profesional (sin datos clínicos ni tokens). */
export function eventLabel(event: string, method: string): string {
  if (event === 'invitation_created') return 'Enlace de acceso generado (24 h)'
  if (event === 'invitation_revoked') return method === 'desvinculacion' ? 'Enlace anulado al desvincular' : 'Enlace anterior anulado'
  if (event === 'link_requested') return 'La clienta ha pedido vincular su cuenta (pendiente de tu aprobación)'
  if (event === 'link_rejected') return 'Solicitud rechazada'
  if (event === 'claim_denied') return 'Intento de vincular con un email que no coincide'
  if (event === 'unlinked') return method === 'ficha_eliminada' ? 'Ficha eliminada' : 'Cuenta desvinculada'
  if (event === 'reassigned') return 'Cuenta reasignada (mantenimiento)'
  if (event === 'linked') {
    if (method === 'email_verificado') return 'Cuenta vinculada (email verificado)'
    if (method === 'aprobacion_profesional') return 'Cuenta vinculada (aprobada por ti)'
    if (method === 'modo_personal') return 'Cuenta personal'
    if (method === 'migracion_inicial') return 'Vinculada antes del registro de vinculaciones'
    return 'Cuenta vinculada (cambio directo)'
  }
  return event
}

/** ¿Vale el consentimiento? Si fue cuestionado por suplantación, solo vale una firma POSTERIOR a esa marca. El registro original nunca se borra. */
export function consentStatus(c: { consentAcceptedAt: string | null; consentInvalidatedAt?: string | null }): 'sin_firmar' | 'vigente' | 'cuestionado' {
  if (!c.consentAcceptedAt) return 'sin_firmar'
  if (c.consentInvalidatedAt && new Date(c.consentAcceptedAt).getTime() <= new Date(c.consentInvalidatedAt).getTime()) return 'cuestionado'
  return 'vigente'
}
