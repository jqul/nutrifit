import { useState } from 'react'
import { FileText, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errors'

/** Puerta de consentimiento informado: se muestra tras registrarse/iniciar
 * sesión, antes de entrar al panel, solo cuando el nutricionista ha
 * subido su propio documento (AjustesTab) y el cliente todavía no lo ha
 * firmado. Firma electrónica ligera (nombre completo + fecha) — no un
 * pad de firma dibujada, para mantener esto simple y consistente con el
 * resto de la app. */
export function ClientConsent({ token, clientName, nutricionistaName, documentUrl, onComplete }: {
  token: string
  clientName: string
  nutricionistaName: string
  documentUrl: string
  onComplete: () => void
}) {
  const [read, setRead] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signedName, setSignedName] = useState(clientName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = agreed && signedName.trim().length > 2

  const handleSign = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    const { error: rpcError } = await supabase.rpc('accept_consent', { p_token: token, p_signed_name: signedName.trim() })
    setLoading(false)
    if (rpcError) { logError('ClientConsent:sign', rpcError); setError('No se pudo registrar la firma. Inténtalo de nuevo.'); return }
    onComplete()
  }

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-center mb-2">Antes de continuar</h1>
        <p className="text-sm text-muted text-center mb-6 leading-relaxed">
          {nutricionistaName} necesita tu consentimiento para tratar tus datos de salud antes de darte acceso a tu panel.
        </p>

        <a href={documentUrl} target="_blank" rel="noreferrer" onClick={() => setRead(true)}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl mb-5 hover:border-accent transition-colors">
          <FileText className="w-5 h-5 text-accent flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Documento de consentimiento</p>
            <p className="text-xs text-muted">Toca para abrirlo y leerlo (PDF)</p>
          </div>
          {read && <CheckCircle2 className="w-5 h-5 text-ok flex-shrink-0" />}
        </a>

        <label className={`flex items-start gap-2.5 mb-5 cursor-pointer ${!read ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={agreed} disabled={!read}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-accent flex-shrink-0" />
          <span className="text-sm text-ink leading-snug">
            He leído y acepto el documento de consentimiento informado.
          </span>
        </label>
        {!read && <p className="text-xs text-muted -mt-4 mb-5">Ábrelo primero para poder marcar esta casilla.</p>}

        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Firma (tu nombre completo)
        </label>
        <input value={signedName} onChange={e => setSignedName(e.target.value)} placeholder="Nombre y apellidos"
          className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-base outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors mb-1" />
        <p className="text-[11px] text-muted mb-5">Escribir tu nombre aquí, junto con la casilla anterior, actúa como tu firma electrónica y queda fechada automáticamente.</p>

        {error && <p className="text-sm text-warn text-center mb-4">{error}</p>}

        <button onClick={handleSign} disabled={!canSubmit || loading}
          className="w-full py-3.5 rounded-2xl bg-ink text-white font-bold text-sm disabled:opacity-40">
          {loading ? 'Firmando...' : 'Firmar y continuar'}
        </button>
      </div>
    </div>
  )
}
