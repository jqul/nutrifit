import { useState, useEffect, useRef } from 'react'
import { Home, Utensils, BarChart2, MoreHorizontal, MessageCircle } from 'lucide-react'
import { buildWAUrl } from '../../lib/whatsapp'
import { supabase } from '../../lib/supabase'
import { ClienteRow } from '../../lib/supabase-types'
import { clientFromRow } from '../../lib/mappers'
import { logError } from '../../lib/errors'
import { NotFound } from '../shared/NotFound'
import { ClientRegister } from './ClientRegister'
import { ClientConsent } from './ClientConsent'
import { ThemeToggle } from '../shared/ThemeToggle'
import { PushToggle } from '../shared/PushToggle'
import { HoyTab } from './HoyTab'
import { DietaClienteTab } from './DietaClienteTab'
import { ProgresoClienteTab } from './ProgresoClienteTab'
import { AnamnesisForm } from './AnamnesisForm'
import { ChangePasswordCard } from '../shared/ChangePasswordCard'
import { useAccentOverride } from '../../lib/useAccentOverride'
import {
  DEMO_CLIENTS, DEMO_NUTRICIONISTA_PROFILE, DEMO_DIET_PLANS,
  DEMO_WEIGHTS, DEMO_CHECKINS, DEMO_PHOTOS, DEMO_MEAL_LOGS, DEMO_BLOOD_MARKERS, DEMO_RECIPES,
} from '../../lib/demo-data'

type Tab = 'hoy' | 'dieta' | 'progreso' | 'mas'
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
  const [client, setClient] = useState<ClienteRow | null>(null)
  const [nutricionistaName, setNutricionistaName] = useState(demoClient ? DEMO_NUTRICIONISTA_PROFILE.displayName : 'Tu nutricionista')
  const [logoUrl, setLogoUrl] = useState<string | null>(demoClient ? DEMO_NUTRICIONISTA_PROFILE.logoUrl : null)
  const [accentColor, setAccentColor] = useState<string | null>(demoClient ? DEMO_NUTRICIONISTA_PROFILE.accentColor : null)
  const [contactPhone, setContactPhone] = useState<string | null>(demoClient ? DEMO_NUTRICIONISTA_PROFILE.contactPhone : null)
  const [consentDocumentUrl, setConsentDocumentUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('hoy')
  useAccentOverride(accentColor)
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
      supabase.rpc('get_client_by_token', { p_token: token }),
      supabase.rpc('get_nutricionista_branding_by_token', { p_token: token }),
    ])
    if (cErr) logError('ClientView:loadClient', cErr)
    const clientData = rows?.[0] || null
    if (!clientData) { setError('Enlace no válido o expirado.'); return }
    setClient(clientData)
    const branding = brandingRows?.[0]
    if (branding?.display_name) setNutricionistaName(branding.display_name)
    setLogoUrl(branding?.logo_url || null)
    setAccentColor(branding?.accent_color || null)
    setContactPhone(branding?.contact_phone || null)
    setConsentDocumentUrl(branding?.consent_document_url || null)

    if (!clientData.auth_user_id) { setAuthState('needs_register'); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!(session?.user && session.user.id === clientData.auth_user_id)) { setAuthState('needs_login'); return }

    if (branding?.consent_document_url && !clientData.consent_accepted_at) {
      setAuthState('needs_consent')
    } else {
      setAuthState('authenticated')
    }
  }

  if (error) return <NotFound />

  if (!demoClient && (authState === 'loading' || !client)) return (
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

  const clientName = demoClient ? `${demoClient.name} ${demoClient.surname}` : `${client!.name || ''} ${client!.surname || ''}`.trim()

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

  const TABS: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'hoy', icon: Home, label: 'Hoy' },
    { id: 'dieta', icon: Utensils, label: 'Dieta' },
    { id: 'progreso', icon: BarChart2, label: 'Progreso' },
    { id: 'mas', icon: MoreHorizontal, label: 'Más' },
  ]

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-bg">
      {demoClient && (
        <div className="bg-accent/10 text-accent text-center text-xs font-semibold py-1.5 flex-shrink-0 z-20">
          Estás viendo la demo del panel del cliente — los datos son ficticios y los cambios no se guardan.
        </div>
      )}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border flex-shrink-0 z-20">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={nutricionistaName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-accent">
                {nutricionistaName[0]}
              </div>
            )}
            <span className="font-serif font-bold text-base">{nutricionistaName}</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold hidden sm:block">{clientName}</p>
            {contactPhone && (
              <a href={buildWAUrl(contactPhone, `Hola ${nutricionistaName.split(' ')[0]}, tengo una duda sobre mi plan`)}
                target="_blank" rel="noreferrer" title="Escribir a tu nutricionista por WhatsApp"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-ok/10 text-ok rounded-lg text-xs font-bold flex-shrink-0">
                <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full relative z-10"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', WebkitOverflowScrolling: 'touch' }}>
        {/* Montadas siempre, solo ocultas con CSS — si no, cambiar de
            pestaña (ej. a Dieta y volver a Hoy) borra el check-in a medio
            rellenar. */}
        <div className={activeTab === 'hoy' ? '' : 'hidden'}>
          <HoyTab client={clientData} demoMode={!!demoClient} />
        </div>
        <div className={activeTab === 'dieta' ? '' : 'hidden'}>
          <DietaClienteTab client={clientData} demoMode={!!demoClient} demoPlan={demoClient ? DEMO_DIET_PLANS[clientData.id] : undefined}
            demoRecipes={demoClient ? DEMO_RECIPES : undefined} />
        </div>
        <div className={activeTab === 'progreso' ? '' : 'hidden'}>
          <ProgresoClienteTab client={clientData} demoMode={!!demoClient} demoData={demoClient ? {
            weights: DEMO_WEIGHTS[clientData.id] || [],
            checkins: DEMO_CHECKINS[clientData.id] || [],
            photos: DEMO_PHOTOS[clientData.id] || [],
            mealLogs: DEMO_MEAL_LOGS[clientData.id] || [],
            bloodMarkers: DEMO_BLOOD_MARKERS[clientData.id] || [],
          } : undefined} nutricionistaLogoUrl={logoUrl} nutricionistaAccentColor={accentColor} />
        </div>
        {activeTab === 'mas' && (
          <div className="px-4 py-6 space-y-4 max-w-xl mx-auto pb-24">
            <h3 className="font-serif font-bold text-xl">Más opciones</h3>
            <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Tu cuenta</p>
              <p className="text-sm"><span className="text-muted">Nombre:</span> <span className="font-semibold">{clientName}</span></p>
              <p className="text-sm"><span className="text-muted">Nutricionista:</span> <span className="font-semibold">{nutricionistaName}</span></p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Modo oscuro</p>
                <p className="text-xs text-muted">Cambia la apariencia de tu panel</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Notificaciones</p>
                <p className="text-xs text-muted">Avisos cuando tu nutricionista actualice tu plan o confirme una cita</p>
              </div>
              <PushToggle clientId={demoClient ? undefined : clientData.id} />
            </div>
            <AnamnesisForm clientId={clientData.id} nutricionistaId={clientData.nutricionistaId} demoMode={!!demoClient} />
            {!demoClient && <ChangePasswordCard />}
            {demoClient ? (
              <a href="/" className="block w-full text-center py-3 border border-border rounded-2xl text-sm font-medium text-muted hover:bg-bg-alt transition-colors">
                Volver al inicio
              </a>
            ) : (
              <button onClick={async () => {
                loggingOutRef.current = true
                setAuthState('needs_login')
                setTimeout(() => { loggingOutRef.current = false }, 5000)
                await supabase.auth.signOut()
              }} className="w-full py-3 border border-border rounded-2xl text-sm font-medium text-muted hover:bg-bg-alt transition-colors">
                Cerrar sesión
              </button>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex max-w-2xl mx-auto">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
              style={{ minHeight: '56px' }} aria-label={label}>
              <Icon className={`w-5 h-5 transition-colors ${activeTab === id ? 'text-ink' : 'text-muted'}`} />
              <span className={`text-[10px] font-medium ${activeTab === id ? 'text-ink font-bold' : 'text-muted'}`}>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
