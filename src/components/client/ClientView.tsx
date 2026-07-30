import { useState, useEffect, useRef } from 'react'
import { Home, Utensils, BarChart2, MoreHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ClienteRow } from '../../lib/supabase-types'
import { clientFromRow } from '../../lib/mappers'
import { logError } from '../../lib/errors'
import { NotFound } from '../shared/NotFound'
import { ClientRegister } from './ClientRegister'
import { ThemeToggle } from '../shared/ThemeToggle'
import { HoyTab } from './HoyTab'
import { DietaClienteTab } from './DietaClienteTab'
import { ProgresoClienteTab } from './ProgresoClienteTab'

type Tab = 'hoy' | 'dieta' | 'progreso' | 'mas'
type AuthState = 'loading' | 'needs_register' | 'needs_login' | 'authenticated'

export function ClientView({ token }: { token: string }) {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [error, setError] = useState('')
  const [client, setClient] = useState<ClienteRow | null>(null)
  const [nutricionistaName, setNutricionistaName] = useState('Tu nutricionista')
  const [activeTab, setActiveTab] = useState<Tab>('hoy')
  const loggingOutRef = useRef(false)
  const authStateRef = useRef(authState)
  authStateRef.current = authState

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (loggingOutRef.current) return
      if (session?.user && authStateRef.current === 'needs_login') setAuthState('authenticated')
    })
    checkAuth()
    return () => subscription.unsubscribe()
  }, [token])

  const checkAuth = async () => {
    const [{ data: rows, error: cErr }, { data: name }] = await Promise.all([
      supabase.rpc('get_client_by_token', { p_token: token }),
      supabase.rpc('get_nutricionista_name_by_token', { p_token: token }),
    ])
    if (cErr) logError('ClientView:loadClient', cErr)
    const clientData = rows?.[0] || null
    if (!clientData) { setError('Enlace no válido o expirado.'); return }
    setClient(clientData)
    if (name) setNutricionistaName(name)

    if (!clientData.auth_user_id) { setAuthState('needs_register'); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user && session.user.id === clientData.auth_user_id) {
      setAuthState('authenticated')
    } else {
      setAuthState('needs_login')
    }
  }

  if (error) return <NotFound />

  if (authState === 'loading' || !client) return (
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

  const clientName = `${client.name || ''} ${client.surname || ''}`.trim()

  if (authState === 'needs_register' || authState === 'needs_login') {
    return (
      <ClientRegister
        token={token}
        clientName={clientName}
        nutricionistaName={nutricionistaName}
        initialStep={authState === 'needs_login' ? 'login' : 'register'}
        onComplete={() => setAuthState('authenticated')}
      />
    )
  }

  const clientData = clientFromRow(client)

  const TABS: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'hoy', icon: Home, label: 'Hoy' },
    { id: 'dieta', icon: Utensils, label: 'Dieta' },
    { id: 'progreso', icon: BarChart2, label: 'Progreso' },
    { id: 'mas', icon: MoreHorizontal, label: 'Más' },
  ]

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-bg">
      <header className="bg-card/95 backdrop-blur-sm border-b border-border flex-shrink-0 z-20">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-accent">
              {nutricionistaName[0]}
            </div>
            <span className="font-serif font-bold text-base">{nutricionistaName}</span>
          </div>
          <p className="text-xs font-semibold">{clientName}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full relative z-10"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', WebkitOverflowScrolling: 'touch' }}>
        {activeTab === 'hoy' && <HoyTab client={clientData} />}
        {activeTab === 'dieta' && <DietaClienteTab clientId={clientData.id} />}
        {activeTab === 'progreso' && <ProgresoClienteTab clientId={clientData.id} />}
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
            <button onClick={async () => {
              loggingOutRef.current = true
              setAuthState('needs_login')
              setTimeout(() => { loggingOutRef.current = false }, 5000)
              await supabase.auth.signOut()
            }} className="w-full py-3 border border-border rounded-2xl text-sm font-medium text-muted hover:bg-bg-alt transition-colors">
              Cerrar sesión
            </button>
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
