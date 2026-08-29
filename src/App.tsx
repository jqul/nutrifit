import { useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { ClientData, UserProfile } from './types'
import { Auth } from './components/shared/Auth'
import { ResetPassword } from './components/shared/ResetPassword'
import { useToast, ToastContainer } from './components/shared/Toast'
import { useAuthBootstrap } from './lib/useAuthBootstrap'
import { useAccentOverride } from './lib/useAccentOverride'
import { DEMO_NUTRICIONISTA_PROFILE, DEMO_CLIENTS } from './lib/demo-data'
import { Mail, Clock } from 'lucide-react'

const NutricionistaDashboard = lazy(() => import('./components/trainer/NutricionistaDashboard').then(m => ({ default: m.NutricionistaDashboard })))
const ClientPanel = lazy(() => import('./components/trainer/ClientPanel').then(m => ({ default: m.ClientPanel })))
const ClientView = lazy(() => import('./components/client/ClientView').then(m => ({ default: m.ClientView })))
const SuperAdminPanel = lazy(() => import('./components/trainer/SuperAdminPanel').then(m => ({ default: m.SuperAdminPanel })))
const PersonalModeShell = lazy(() => import('./components/trainer/PersonalModeShell').then(m => ({ default: m.PersonalModeShell })))

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
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
}

function PendingApprovalScreen({ displayName, email, onLogout }: { displayName: string; email: string; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-serif font-bold mb-8">Nutri<span className="text-accent italic">Fit</span></h1>
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="w-7 h-7 text-accent" /></div>
          <h2 className="font-serif font-bold text-xl mb-2">Cuenta pendiente de aprobación</h2>
          <p className="text-muted text-sm leading-relaxed">
            Hola <strong>{displayName}</strong>, tu cuenta está creada pero aún no ha sido activada. Te avisaremos en cuanto puedas entrar.
          </p>
          <a href={`mailto:javier.quinones.lopez@gmail.com?subject=Activar cuenta NutriFit&body=Hola, soy ${displayName} (${email})`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline underline-offset-2">
            <Mail className="w-3.5 h-3.5" /> Contactar
          </a>
          <button onClick={onLogout} className="mt-6 w-full py-3 border border-border rounded-xl text-sm font-bold hover:bg-bg-alt">Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}

function DemoCTA({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-border shadow-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm text-muted hidden sm:block">Estás viendo la demo — los datos son ficticios y los cambios no se guardan.</p>
      <p className="text-sm font-medium sm:hidden">¿Te convence NutriFit?</p>
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <button onClick={onLogin} className="text-sm text-muted hover:text-ink px-3 py-1.5 rounded-lg hover:bg-bg-alt transition-colors">Entrar</button>
        <button onClick={onRegister} className="text-sm font-semibold bg-accent text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">Solicitar acceso gratis →</button>
        <button onClick={() => setDismissed(true)} className="text-muted/50 hover:text-muted ml-1 text-lg leading-none" aria-label="Cerrar">×</button>
      </div>
    </div>
  )
}

function DemoView({ selectedClient, setSelectedClient, onRegister, onLogin }: {
  selectedClient: ClientData | null
  setSelectedClient: (c: ClientData | null) => void
  onRegister: () => void
  onLogin: () => void
}) {
  const demoProfile: UserProfile = DEMO_NUTRICIONISTA_PROFILE
  return (
    <>
      <DemoCTA onRegister={onRegister} onLogin={onLogin} />
      <div className="pb-16">
        {selectedClient ? (
          <ClientPanel client={selectedClient} userProfile={demoProfile} onClose={() => setSelectedClient(null)} demoMode />
        ) : (
          <NutricionistaDashboard userProfile={demoProfile} onLogout={() => { window.location.href = '/' }}
            demoClients={DEMO_CLIENTS} onSelectClient={setSelectedClient} onUpdateProfile={() => {}} />
        )}
      </div>
    </>
  )
}

export default function App() {
  const { view, userProfile, pendingUser, clientToken, logout, setView, setUserProfile } = useAuthBootstrap()
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null)
  const [adminSubview, setAdminSubview] = useState<'admin' | 'trainer'>('admin')
  const { toasts } = useToast()
  useAccentOverride(view === 'trainer' ? userProfile?.accentColor : null)

  if (view === 'loading') return <LoadingScreen />

  return (
    <Suspense fallback={<LoadingScreen />}>
      {view === 'client-token' && clientToken && (
        <ClientView token={clientToken} />
      )}

      {view === 'reset-password' && (
        <ResetPassword onDone={() => setView('auth')} />
      )}

      {view === 'auth' && (
        <Auth
          onAuth={() => supabase.auth.getSession().then(({ data }) => {
            if (data.session?.user) {
              // onAuthStateChange lo manejará — solo forzamos si no dispara
            }
          })}
          onDemo={() => { window.history.pushState({}, '', '/?demo=1'); setView('demo') }}
        />
      )}

      {view === 'demo' && (
        <DemoView
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          onRegister={() => { window.history.pushState({}, '', '/'); setView('auth') }}
          onLogin={() => { window.history.pushState({}, '', '/'); setView('auth') }}
        />
      )}

      {view === 'pending-approval' && pendingUser && (
        <PendingApprovalScreen displayName={pendingUser.displayName} email={pendingUser.email} onLogout={logout} />
      )}

      {view === 'trainer' && userProfile && (
        userProfile.accountMode === 'personal' ? (
          <PersonalModeShell userProfile={userProfile} onLogout={logout} />
        ) : userProfile.role === 'super_admin' && adminSubview === 'admin' ? (
          <SuperAdminPanel onLogout={logout} onSwitchToTrainer={() => setAdminSubview('trainer')} />
        ) : selectedClient ? (
          <ClientPanel
            client={selectedClient}
            userProfile={userProfile}
            onClose={() => setSelectedClient(null)}
          />
        ) : (
          <NutricionistaDashboard
            userProfile={userProfile}
            onLogout={logout}
            onSelectClient={setSelectedClient}
            onUpdateProfile={updates => setUserProfile(prev => prev ? { ...prev, ...updates } : prev)}
            onSwitchToAdmin={userProfile.role === 'super_admin' ? () => setAdminSubview('admin') : undefined}
          />
        )
      )}

      <ToastContainer toasts={toasts} />
    </Suspense>
  )
}
