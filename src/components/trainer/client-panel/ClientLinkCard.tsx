import { useCallback, useEffect, useState } from 'react'
import { Copy, Link2, ShieldCheck, UserX } from 'lucide-react'
import { ClientData } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../shared/Button'
import { Modal } from '../../shared/Modal'
import { toast } from '../../shared/Toast'
import { eventLabel, interpretManagement, invitationUrl, parseInvitationCreated } from '../../../lib/clientLink'

interface LinkRequest { id: string; requester_uid: string; requester_email: string; created_at: string; expires_at: string }
interface LinkEvent { id: number; occurred_at: string; event: string; method: string }

const fecha = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Acceso de la clienta a su app: enlace de 24 h y un solo uso, aprobación de solicitudes (fichas sin email) y desvinculación.
 * Sustituye a «Copiar enlace / Regenerar enlace»: el enlace antiguo ya no sirve para crear una cuenta (migraciones 0077-0079).
 */
export function ClientLinkCard({ client, demoMode, onChanged }: {
  client: ClientData
  demoMode?: boolean
  /** Para que la ficha abierta refleje el cambio sin recargar. */
  onChanged: (patch: Partial<ClientData>) => void
}) {
  const linked = !!client.authUserId
  const [invitation, setInvitation] = useState<{ url: string; expiresAt: string } | null>(null)
  const [requests, setRequests] = useState<LinkRequest[]>([])
  const [events, setEvents] = useState<LinkEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [impersonation, setImpersonation] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const [r, e] = await Promise.all([
      supabase.from('client_link_requests').select('id, requester_uid, requester_email, created_at, expires_at').eq('client_id', client.id).is('decision', null).gt('expires_at', new Date().toISOString()),
      supabase.from('client_link_events').select('id, occurred_at, event, method').eq('client_id', client.id).order('id', { ascending: false }).limit(5),
    ])
    setRequests((r.data as LinkRequest[]) ?? []); setEvents((e.data as LinkEvent[]) ?? [])
  }, [client.id, demoMode])
  useEffect(() => { load() }, [load, linked])

  const generate = async () => {
    if (demoMode) { toast('Modo demo: no se genera ningún enlace', 'ok'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('create_client_invitation', { p_client_id: client.id })
    setBusy(false)
    const inv = parseInvitationCreated(data)
    if (error || !inv) { toast('No se ha podido generar el enlace: ' + (error?.message ?? 'respuesta no válida'), 'warn'); return }
    const url = invitationUrl(window.location.origin, inv.token)
    setInvitation({ url, expiresAt: inv.expiresAt })
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado ✓ (vale 24 h y se usa una sola vez)', 'ok') } catch { toast('Enlace generado: cópialo abajo', 'ok') }
    load()
  }
  const copy = async () => {
    if (!invitation) return
    try { await navigator.clipboard.writeText(invitation.url); toast('Enlace copiado ✓', 'ok') } catch { toast('No se pudo copiar: selecciónalo y cópialo a mano', 'warn') }
  }
  const unlink = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('unlink_client_account', { p_client_id: client.id, p_reason: reason.trim() || null, p_impersonation: impersonation })
    setBusy(false)
    const r = interpretManagement(data, error, ['unlinked'])
    if (!r.ok) { toast(r.message, 'warn'); return }
    const cuestionado = !!(data as { consent_invalidated?: boolean } | null)?.consent_invalidated
    toast(cuestionado ? 'Cuenta desvinculada. El consentimiento firmado por esa cuenta queda cuestionado: pide a la clienta que lo firme de nuevo.' : 'Cuenta desvinculada: pierde el acceso de inmediato', 'ok')
    setUnlinkOpen(false); setReason(''); setImpersonation(false); setInvitation(null)
    onChanged(cuestionado ? { authUserId: null, consentInvalidatedAt: new Date().toISOString() } : { authUserId: null }); load()
  }
  const decide = async (req: LinkRequest, approve: boolean) => {
    setBusy(true)
    const { data, error } = approve
      ? await supabase.rpc('approve_client_link', { p_request_id: req.id })
      : await supabase.rpc('reject_client_link', { p_request_id: req.id, p_reason: null })
    setBusy(false)
    const r = interpretManagement(data, error, approve ? ['linked'] : ['rejected'])
    if (!r.ok) { toast(r.message, 'warn'); load(); return }
    toast(approve ? 'Cuenta vinculada ✓' : 'Solicitud rechazada', 'ok')
    if (approve) onChanged({ authUserId: req.requester_uid })
    load()
  }

  return (
    <div className="card p-5 space-y-3" aria-label="Acceso de la clienta">
      <div className="flex items-center gap-2">
        {linked ? <ShieldCheck className="w-4 h-4 text-ok" /> : <Link2 className="w-4 h-4 text-muted" />}
        <p className="text-sm font-semibold">{linked ? 'Cuenta vinculada' : 'Sin cuenta vinculada'}</p>
      </div>

      {linked ? (
        <>
          <p className="text-xs text-muted">Esta ficha tiene una cuenta con acceso a su app. Si no es la persona correcta o ha perdido el acceso, desvincúlala: se corta al instante y podrás generar un enlace nuevo.</p>
          <Button variant="danger" onClick={() => setUnlinkOpen(true)} disabled={demoMode}><UserX className="w-3.5 h-3.5" /> Desvincular cuenta</Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            {client.email
              ? <>El enlace sirve para crear su cuenta con el email <strong className="text-ink">{client.email}</strong> (tendrá que confirmarlo). Vale 24 horas y se usa una sola vez.</>
              : <>Esta ficha no tiene email: cuando use el enlace, <strong className="text-ink">tendrás que aprobar tú su solicitud</strong>. El enlace vale 24 horas y se usa una sola vez.</>}
          </p>
          <Button variant="outline" onClick={generate} loading={busy}><Copy className="w-3.5 h-3.5" /> Generar enlace de acceso (24 h)</Button>
          {invitation && (
            <div className="rounded-xl bg-bg-alt p-3 space-y-1.5">
              <p className="text-xs text-muted">Solo se muestra ahora (caduca el {fecha(invitation.expiresAt)}). Si lo pierdes, genera otro: el anterior queda anulado.</p>
              <div className="flex items-center gap-2">
                <input readOnly value={invitation.url} aria-label="Enlace de acceso" onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg border border-border bg-card" />
                <Button variant="ghost" size="sm" onClick={copy}>Copiar</Button>
              </div>
            </div>
          )}
        </>
      )}

      {requests.map(r => (
        <div key={r.id} role="alert" className="rounded-xl border border-notice/40 bg-notice/10 p-3 space-y-2">
          <p className="text-sm font-semibold">Solicitud de vinculación pendiente</p>
          <p className="text-xs text-muted">La cuenta <strong className="text-ink">{r.requester_email}</strong> (email confirmado) ha usado el enlace el {fecha(r.created_at)}. Apruébala solo si es la persona de esta ficha: confírmalo con ella por otro medio.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(r, true)} loading={busy}>Aprobar</Button>
            <Button size="sm" variant="outline" onClick={() => decide(r, false)} disabled={busy}>Rechazar</Button>
          </div>
        </div>
      ))}

      {events.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none">Historial de vinculación</summary>
          <ul className="mt-1.5 space-y-0.5">{events.map(e => <li key={e.id}>{fecha(e.occurred_at)} · {eventLabel(e.event, e.method)}</li>)}</ul>
        </details>
      )}

      <Modal open={unlinkOpen} onClose={() => setUnlinkOpen(false)} title="Desvincular cuenta">
        <div className="space-y-4">
          <p className="text-sm text-muted">La cuenta actual <strong className="text-ink">pierde el acceso a esta ficha de inmediato</strong> (plan, seguimiento, fotos, mensajes) y se borran sus notificaciones push. No se borra ningún dato de la ficha.</p>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Motivo (queda en el historial)
            <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Ej.: cambió de email / no era la persona" className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-bg text-sm normal-case tracking-normal font-normal text-ink" />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={impersonation} onChange={e => setImpersonation(e.target.checked)} className="mt-1" />
            <span>Sospecho una <strong>suplantación</strong>: cuestionar el consentimiento que firmó esa cuenta. <span className="text-muted">No se borra nada: el registro original se conserva y solo deja de contar como consentimiento de la clienta. No afecta a otros consentimientos.</span></span>
          </label>
          <div className="flex gap-2">
            <Button variant="danger" onClick={unlink} loading={busy}>Sí, desvincular</Button>
            <Button variant="ghost" onClick={() => setUnlinkOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
