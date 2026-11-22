import { supabase } from './supabase'
import { invitationUrl, parseInvitationCreated } from './clientLink'

/** Genera un enlace de acceso para la ficha (24 h, un solo uso; revoca el anterior). El token solo existe en esta respuesta. */
export async function createInvitationUrl(clientId: string): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('create_client_invitation', { p_client_id: clientId })
  const inv = parseInvitationCreated(data)
  if (error || !inv) return { ok: false, message: error?.message ?? 'respuesta no válida' }
  return { ok: true, url: invitationUrl(window.location.origin, inv.token), expiresAt: inv.expiresAt }
}
