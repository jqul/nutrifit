import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { UserProfile } from '../types'
import { isStandalone } from './standalone'
import { decideForNonTrainerSession, isValidClientToken, readRememberedClientToken, rememberClientToken } from './clientApp'

export type AppView = 'loading' | 'auth' | 'trainer' | 'client-token' | 'pending-approval' | 'reset-password' | 'demo'

export interface PendingUser {
  uid: string
  email: string
  displayName: string
}

export function useAuthBootstrap() {
  const [view, setView] = useState<AppView>('loading')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  // true si la app se ha abierto SIN enlace y se ha ido a la del cliente por el token recordado en este dispositivo.
  const [clientFromStorage, setClientFromStorage] = useState(false)
  const loggingOutRef = useRef(false)
  const clientFallbackRef = useRef(false)

  // `notATrainer`: qué hacer si la sesión no es de un nutricionista (p. ej. es la de un cliente). Sin él, se cierra la sesión.
  const loadProfile = async (uid: string, email: string, notATrainer?: () => void) => {
    const { data, error } = await supabase
      .from('nutricionistas')
      .select('display_name, approved, role, custom_anamnesis_questions, logo_url, accent_color, custom_domain, contact_phone, consent_document_url, account_mode')
      .eq('uid', uid)
      .maybeSingle()

    // Un fallo al consultar NO es "no eres nutricionista": cerrar la sesión por un corte de red echaba a cualquiera.
    if (error) { console.error(error); setView('auth'); return }

    if (!data) {
      // Sesión sin cuenta de nutricionista. Si es un CLIENTE (entró por "/" en vez de por su enlace, p. ej. desde el
      // icono de la pantalla de inicio), se le lleva a su app con la sesión intacta: antes se le cerraba la sesión y
      // tenía que escribir correo y contraseña cada vez.
      const outcome = await decideForNonTrainerSession(() => supabase.rpc('get_my_client_token'), !!notATrainer)
      if (outcome.kind === 'client') {
        rememberClientToken(outcome.token)
        clientFallbackRef.current = true
        window.history.replaceState({}, '', `/?c=${outcome.token}`)   // así "añadir a la pantalla de inicio" desde aquí también abre su enlace
        setClientToken(outcome.token); setClientFromStorage(false); setView('client-token')
      } else if (outcome.kind === 'keep-session') setView('auth')
      else if (outcome.kind === 'remembered') notATrainer?.()
      else { await supabase.auth.signOut(); setView('auth') }
      return
    }

    if (data.approved === false) {
      setPendingUser({ uid, email, displayName: data.display_name || email.split('@')[0] })
      setView('pending-approval')
      return
    }

    setUserProfile({
      uid, email,
      displayName: data.display_name || email.split('@')[0],
      role: data.role === 'super_admin' ? 'super_admin' : 'trainer',
      approved: true,
      createdAt: Date.now(),
      customAnamnesisQuestions: data.custom_anamnesis_questions || [],
      logoUrl: data.logo_url ?? null,
      accentColor: data.accent_color ?? null,
      customDomain: data.custom_domain ?? null,
      contactPhone: data.contact_phone ?? null,
      consentDocumentUrl: data.consent_document_url ?? null,
      accountMode: data.account_mode === 'personal' ? 'personal' : 'professional',
    })
    setView('trainer')
  }

  const logout = async () => {
    loggingOutRef.current = true
    setView('auth')
    setUserProfile(null)
    setPendingUser(null)
    setTimeout(() => { loggingOutRef.current = false }, 5000)
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('c')
    if (token) {
      // El enlace del cliente: se recuerda para que el icono de la pantalla de inicio vuelva a abrirlo.
      if (isValidClientToken(token)) rememberClientToken(token)
      setClientToken(token); setView('client-token'); return
    }
    if (params.get('demo') === '1') { setView('demo'); return }

    // La app instalada se abre en "/" sin enlace: si en este dispositivo ya se abrió el de un cliente,
    // se vuelve a la app del cliente (salvo que haya una sesión de nutricionista). Fuera de la app
    // instalada no se hace nada: en el navegador manda lo de siempre.
    const remembered = isStandalone() ? readRememberedClientToken() : null
    const openRememberedClient = () => {
      clientFallbackRef.current = true
      setClientToken(remembered); setClientFromStorage(true); setView('client-token')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) loadProfile(data.session.user.id, data.session.user.email || '', remembered ? openRememberedClient : undefined)
      else if (remembered) openRememberedClient()
      else setView('auth')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (clientFallbackRef.current) return   // ya estamos en la app del cliente: sus sesiones no son de nutricionista
      if (loggingOutRef.current) {
        if (event === 'SIGNED_OUT') loggingOutRef.current = false
        return
      }
      if (event === 'PASSWORD_RECOVERY') { setView('reset-password'); return }
      if (session?.user) loadProfile(session.user.id, session.user.email || '', remembered ? openRememberedClient : undefined)
      else { setView('auth'); setUserProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  return { view, userProfile, pendingUser, clientToken, clientFromStorage, logout, setView, setUserProfile }
}
