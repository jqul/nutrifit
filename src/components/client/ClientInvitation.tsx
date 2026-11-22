import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ClientRegister } from './ClientRegister'
import { interpretClaim, invitationProblem, ClaimOutcome } from '../../lib/clientLink'
import { rememberClientToken, isValidClientToken } from '../../lib/clientApp'

interface InvitationInfo {
  status: string
  client_first_name: string | null
  requires_approval: boolean | null
  display_name: string | null
}

type Phase =
  | { name: 'loading' }
  | { name: 'problem'; title: string; message: string }
  | { name: 'auth'; info: InvitationInfo }                 // enlace válido, falta una sesión (crear cuenta o entrar)
  | { name: 'claiming'; info: InvitationInfo }
  | { name: 'outcome'; info: InvitationInfo; outcome: ClaimOutcome }

/**
 * Pantalla del enlace de acceso (/?i=<invitación>). Crear la cuenta y vincularla a la ficha son DOS pasos:
 * este componente hace el segundo, y solo muestra éxito cuando la base devuelve un resultado explícito de éxito.
 * (Antes, la pantalla daba «¡Todo listo!» sin comprobar nada y la persona podía quedarse sin ficha.)
 */
export function ClientInvitation({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })
  const infoRef = useRef<InvitationInfo | null>(null)
  const claimingRef = useRef(false)

  const claim = async (info: InvitationInfo) => {
    if (claimingRef.current) return
    claimingRef.current = true
    setPhase({ name: 'claiming', info })
    const { data, error } = await supabase.rpc('claim_client_with_invitation', { p_token: token })
    claimingRef.current = false
    const outcome = interpretClaim(data, error)
    if (error) console.error(error)
    if (outcome.kind === 'linked') {
      // Éxito real: se abre su app con el token de SU ficha.
      const { data: ficha } = await supabase.rpc('get_my_client_token')
      if (isValidClientToken(ficha)) { rememberClientToken(ficha); window.location.replace(`/?c=${ficha}`); return }
    }
    setPhase({ name: 'outcome', info, outcome })
  }

  const afterSession = async () => {
    const info = infoRef.current
    if (!info) return
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await claim(info)
    else setPhase({ name: 'auth', info })
  }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.rpc('get_invitation_status', { p_token: token })
      if (!vivo) return
      const info = (Array.isArray(data) ? data[0] : data) as InvitationInfo | undefined
      if (error || !info) { setPhase({ name: 'problem', title: 'No se ha podido comprobar el enlace', message: 'Inténtalo de nuevo en unos minutos.' }); return }
      const problema = invitationProblem(info.status)
      if (problema) { setPhase({ name: 'problem', ...problema }); return }
      infoRef.current = info
      await afterSession()
    })()
    // Al volver del email de confirmación hay sesión nueva: se intenta vincular.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && infoRef.current) afterSession()
    })
    return () => { vivo = false; subscription.unsubscribe() }
  }, [token])

  if (phase.name === 'loading' || phase.name === 'claiming') {
    return <div className="min-h-[100dvh] bg-bg flex items-center justify-center text-sm text-muted" role="status">{phase.name === 'claiming' ? 'Vinculando tu cuenta…' : 'Comprobando tu enlace…'}</div>
  }

  if (phase.name === 'problem') {
    return (
      <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-serif font-bold mb-2">{phase.title}</h1>
        <p className="text-sm text-muted max-w-xs leading-relaxed">{phase.message}</p>
      </div>
    )
  }

  if (phase.name === 'outcome') {
    const { outcome, info } = phase
    return (
      <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-6 text-center" role={outcome.kind === 'failed' ? 'alert' : 'status'}>
        <h1 className="text-xl font-serif font-bold mb-2">{outcome.title}</h1>
        <p className="text-sm text-muted max-w-xs leading-relaxed">{outcome.message}</p>
        {outcome.kind === 'need_email_confirmation' && (
          <button onClick={() => claim(info)} className="mt-6 px-5 py-3 rounded-2xl bg-ink text-white font-bold text-sm">Ya lo he confirmado</button>
        )}
        {outcome.kind === 'failed' && ['rpc_error', 'unknown'].includes(outcome.code) && (
          <button onClick={() => claim(info)} className="mt-6 px-5 py-3 rounded-2xl bg-ink text-white font-bold text-sm">Reintentar</button>
        )}
      </div>
    )
  }

  // phase.name === 'auth'
  return (
    <ClientRegister
      clientName={phase.info.client_first_name || 'Hola'}
      nutricionistaName={phase.info.display_name || 'Tu nutricionista'}
      onComplete={afterSession}
    />
  )
}
