import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { ClienteRow } from '../../lib/supabase-types'
import { clientFromRow } from '../../lib/mappers'
import { logError } from '../../lib/errors'
import { NotFound } from '../shared/NotFound'
import { ClientRegister } from './ClientRegister'
import { ClientConsent } from './ClientConsent'
import { ClientAppShell } from './ClientAppShell'
import {
  DEMO_CLIENTS, DEMO_NUTRICIONISTA_PROFILE, DEMO_DIET_PLANS,
  DEMO_WEIGHTS, DEMO_CHECKINS, DEMO_PHOTOS, DEMO_MEAL_LOGS, DEMO_BLOOD_MARKERS, DEMO_CLINICAL_NOTES, DEMO_RECIPES,
} from '../../lib/demo-data'

type AuthState = 'loading' | 'needs_register' | 'needs_login' | 'needs_consent' | 'authenticated'

// Los enlaces "Copiar enlace del cliente" del panel de demo generan tokens
// con este prefijo (ver DEMO_CLIENTS) — se resuelven contra los datos de
// demo en vez de consultar Supabase, para que se puedan abrir sin cuenta
// real ni datos en la base de datos.
const DEMO_TOKEN_PREFIX = 'demo-token-'

export function ClientView({ token }: { token: string }) {
  const demoClient = token.startsWith(DEMO_TOKEN_PREFIX) ? DEMO_CLIENTS.find(c => c.token === token) : undefined

  const [authState, setAuthState] = useState<AuthState>(demoClient ? 'authenticated' : 'loading')
  const [error, setError] = useState(demoClient === undefined && token.startsWith(DEMO_TOKEN_PREFIX) ? 'Enlace no válido o expirado.' : '')
  // Datos mínimos del cliente ANTES de autenticarse (nombre para el
  // saludo + los 3 flags que deciden registro/login/consentimiento) —
  // vienen de get_client_auth_status_by_token, un RPC público deliberadamente
  // estrecho. La ficha COMPLETA (client, más abajo) solo se carga una vez
  // autenticado de verdad, con una consulta normal protegida por RLS.
  const [authStatus, setAuthStatus] = useState<{ id: string; name: string; surname: string } | null>(null)
  const [client, setClient] = useState<ClienteRow | null>(null)
  const [nutricionistaName, setNutricionistaName] = useState(demoClient ? DEMO_NUTRICIONISTA_PROFILE.displayName : 'Tu nutricionista')
  const [logoUrl, setLogoUrl] = useState<string | null>(demoClient ? DEMO_NUTRICIONISTA_PROFILE.logoUrl : null)
  const [accentColor, setAccentColor] = useState<string | null>(demoClient ? DEMO_NUTRICIONISTA_PROFILE.accentColor : null)
  const [contactPhone, setContactPhone] = useState<string | null>(demoClient ? DEMO_NUTRICIONISTA_PROFILE.contactPhone : null)
  const [consentDocumentUrl, setConsentDocumentUrl] = useState<string | null>(null)
  const loggingOutRef = useRef(false)
  const authStateRef = useRef(authState)
  authStateRef.current = authState

  useEffect(() => {
    if (demoClient) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (loggingOutRef.current) return
      if (session?.user && authStateRef.current === 'needs_login') checkAuth()
    })
    checkAuth()
    return () => subscription.unsubscribe()
  }, [token])

  const checkAuth = async () => {
    const [{ data: rows, error: cErr }, { data: brandingRows }] = await Promise.all([
      supabase.rpc('get_client_auth_status_by_token', { p_token: token }),
      supabase.rpc('get_nutricionista_branding_by_token', { p_token: token }),
    ])
    if (cErr) logError('ClientView:loadClient', cErr)
    const status = rows?.[0] || null
    if (!status) { setError('Enlace no válido o expirado.'); return }
    setAuthStatus({ id: status.id, name: status.name, surname: status.surname })
    const branding = brandingRows?.[0]
    if (branding?.display_name) setNutricionistaName(branding.display_name)
    setLogoUrl(branding?.logo_url || null)
    setAccentColor(branding?.accent_color || null)
    setContactPhone(branding?.contact_phone || null)
    setConsentDocumentUrl(branding?.consent_document_url || null)

    if (!status.auth_user_id) { setAuthState('needs_register'); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!(session?.user && session.user.id === status.auth_user_id)) { setAuthState('needs_login'); return }

    if (branding?.consent_document_url && !status.consent_accepted_at) {
      setAuthState('needs_consent')
      return
    }

    // Autenticado de verdad — a partir de aquí la RLS normal
    // (auth_user_id = auth.uid()) ya protege la fila completa, sin
    // necesitar ningún RPC ampliado.
    const { data: fullRow, error: fullErr } = await supabase.from('clientes').select('*').eq('id', status.id).single()
    if (fullErr || !fullRow) { setError('No se pudo cargar tu perfil.'); return }
    setClient(fullRow)
    setAuthState('authenticated')
  }

  if (error) return <NotFound />

  if (!demoClient && (authState === 'loading' || !authStatus)) return (
    <div className="min-h-[100dvh] bg-bg flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></h1>
        <div className="flex gap-1 justify-center">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  const clientName = demoClient ? `${demoClient.name} ${demoClient.surname}` : `${authStatus!.name || ''} ${authStatus!.surname || ''}`.trim()

  if (!demoClient && (authState === 'needs_register' || authState === 'needs_login')) {
    return (
      <ClientRegister
        token={token}
        clientName={clientName}
        nutricionistaName={nutricionistaName}
        initialStep={authState === 'needs_login' ? 'login' : 'register'}
        onComplete={checkAuth}
      />
    )
  }

  if (!demoClient && authState === 'needs_consent' && consentDocumentUrl) {
    return (
      <ClientConsent
        token={token}
        clientName={clientName}
        nutricionistaName={nutricionistaName}
        documentUrl={consentDocumentUrl}
        onComplete={checkAuth}
      />
    )
  }

  const clientData = demoClient || clientFromRow(client!)

  const handleSignOut = async () => {
    loggingOutRef.current = true
    setAuthState('needs_login')
    setTimeout(() => { loggingOutRef.current = false }, 5000)
    await supabase.auth.signOut()
  }

  return (
    <ClientAppShell
      clientData={clientData}
      demoMode={!!demoClient}
      bannerText={demoClient ? 'Estás viendo la demo del panel del cliente — los datos son ficticios y los cambios no se guardan.' : undefined}
      nutricionistaName={nutricionistaName}
      logoUrl={logoUrl}
      accentColor={accentColor}
      contactPhone={contactPhone}
      demoPlan={demoClient ? DEMO_DIET_PLANS[clientData.id] : undefined}
      demoRecipes={demoClient ? DEMO_RECIPES : undefined}
      demoData={demoClient ? {
        weights: DEMO_WEIGHTS[clientData.id] || [],
        checkins: DEMO_CHECKINS[clientData.id] || [],
        photos: DEMO_PHOTOS[clientData.id] || [],
        mealLogs: DEMO_MEAL_LOGS[clientData.id] || [],
        bloodMarkers: DEMO_BLOOD_MARKERS[clientData.id] || [],
        clinicalNotes: DEMO_CLINICAL_NOTES[clientData.id] || [],
      } : undefined}
      onSignOut={handleSignOut}
    />
  )
}
