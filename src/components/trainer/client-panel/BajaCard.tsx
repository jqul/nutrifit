import { useState } from 'react'
import { ClientData } from '../../../types'
import { BAJA_REASONS, BajaReason, bajaReasonLabel, formatTenure } from '../../../lib/clientBaja'
import { Button } from '../../shared/Button'
import { Modal } from '../../shared/Modal'
import { UserMinus, RotateCcw } from 'lucide-react'

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

/** Aviso en la ficha de un cliente que está de baja, con la forma de reactivarlo. */
export function BajaBanner({ client, onReactivate }: { client: ClientData; onReactivate: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  if (client.bajaAt == null) return null
  const stayedDays = Math.max(0, Math.round((client.bajaAt - client.createdAt) / 86400000))
  const reactivate = async () => { setBusy(true); await onReactivate(); setBusy(false) }
  return (
    <div role="status" className="card p-4 mb-6 border-notice/40 bg-notice/5 flex items-start gap-3 flex-wrap">
      <UserMinus className="w-5 h-5 text-notice flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-[200px] space-y-0.5">
        <p className="text-sm font-semibold">De baja desde el {fmtDate(client.bajaAt)}</p>
        <p className="text-xs text-muted">
          {bajaReasonLabel(client.bajaReason)} · estuvo {formatTenure(stayedDays)}. No aparece en tu lista ni recibe recordatorios; conservas todo su historial.
        </p>
        {client.bajaNote && <p className="text-xs text-muted italic">«{client.bajaNote}»</p>}
      </div>
      <Button size="sm" variant="outline" onClick={reactivate} loading={busy}><RotateCcw className="w-3.5 h-3.5" /> Reactivar</Button>
    </div>
  )
}

/**
 * Dar de baja a un cliente activo. No borra nada: sale de la lista, del Centro
 * de control, de los avisos y de los recordatorios, y se puede reactivar.
 */
export function DarDeBajaCard({ client, onDismiss }: { client: ClientData; onDismiss: (reason: BajaReason | null, note: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<BajaReason | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (client.bajaAt != null) return null

  const confirm = async () => {
    setBusy(true)
    const ok = await onDismiss(reason || null, note)
    setBusy(false)
    if (ok) { setOpen(false); setReason(''); setNote('') }
  }

  return (
    <>
      <div className="card p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Baja del cliente</p>
        <p className="text-xs text-muted">Si deja de ser tu cliente, dale de baja en vez de eliminarlo: sale de tu lista y deja de contar en tus avisos e ingresos, pero conservas su historial y puedes reactivarlo.</p>
        <Button variant="outline" onClick={() => setOpen(true)}><UserMinus className="w-3.5 h-3.5" /> Dar de baja</Button>
      </div>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Dar de baja">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            <strong className="text-ink">{client.name} {client.surname}</strong> dejará de aparecer en tu lista, el Centro de control, los avisos y la facturación mensual, y no recibirá recordatorios. No se borra nada.
          </p>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Motivo (opcional)</legend>
            {BAJA_REASONS.map(r => (
              <label key={r.id} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${reason === r.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'}`}>
                <input type="radio" name="baja-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="mt-1 accent-accent" />
                <span><span className="text-sm font-semibold block">{r.label}</span><span className="text-xs text-muted">{r.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="baja-note" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nota (opcional)</label>
            <textarea id="baja-note" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <div className="flex gap-2">
            <Button onClick={confirm} loading={busy}>Dar de baja</Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
