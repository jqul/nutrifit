import { useState, useEffect } from 'react'
import { UserProfile, ClientData } from '../../types'
import { supabase } from '../../lib/supabase'
import { clientFromRow, clientToRow } from '../../lib/mappers'
import { toast } from '../shared/Toast'
import { ThemeToggle } from '../shared/ThemeToggle'
import { InstallAppButton } from '../shared/InstallAppButton'
import { HoyTab } from '../client/HoyTab'
import { DietaClienteTab } from '../client/DietaClienteTab'
import { ProgresoClienteTab } from '../client/ProgresoClienteTab'
import { PlanDietaTab } from './client-panel/PlanDietaTab'
import { PerfilTab } from './client-panel/PerfilTab'
import { PersonalOnboarding } from './PersonalOnboarding'
import { AnamnesisForm } from '../client/AnamnesisForm'
import { LogOut } from 'lucide-react'

type Tab = 'hoy' | 'dieta' | 'progreso' | 'plan' | 'perfil'

const TABS: { id: Tab; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'dieta', label: 'Dieta' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'plan', label: 'Editar plan' },
  { id: 'perfil', label: 'Perfil' },
]

/**
 * Modo personal: alguien que quiere llevar su propia dieta, sin ser
 * profesional ni tener clientes. En vez de un panel nuevo desde cero, es
 * simplemente su propia ficha de cliente (creada automáticamente al
 * registrarse, ver la migración 0029) combinando las mismas piezas que ya
 * existen: el seguimiento diario del lado cliente (Hoy/Dieta/Progreso) y el
 * editor de plan del lado nutricionista (Editar plan/Perfil) — sin
 * "Mensajes" (no tiene sentido escribirse a uno mismo) ni "Seguimiento" del
 * lado nutricionista (ya está Hoy/Progreso, que es lo mismo pero mejor
 * pensado para el propio usuario).
 */
export function PersonalModeShell({ userProfile, onLogout }: {
  userProfile: UserProfile
  onLogout: () => void
}) {
  const [client, setClient] = useState<ClientData | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('hoy')
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('*').eq('auth_user_id', userProfile.uid).maybeSingle()
      .then(({ data }) => setClient(data ? clientFromRow(data) : null))
  }, [userProfile.uid])

  const handleUpdate = async (updates: Partial<ClientData>) => {
    if (!client) return false
    const row = clientToRow(updates)
    const { error } = await supabase.from('clientes').update(row).eq('id', client.id)
    if (error) { toast('Error: ' + error.message, 'warn'); return false }
    setClient({ ...client, ...updates })
    return true
  }

  // El "enlace" de la ficha no se usa en modo personal (se entra siempre
  // con la cuenta propia), pero PerfilTab lo muestra igualmente — regenerarlo
  // es inofensivo, así que se deja funcionar de verdad en vez de ocultarlo.
  const handleRegenerateToken = async () => {
    if (!client) return null
    const token = Math.random().toString(36).slice(2, 14)
    const { error } = await supabase.from('clientes').update({ token }).eq('id', client.id)
    if (error) return null
    setClient({ ...client, token })
    return token
  }

  // A diferencia de un cliente de verdad, borrar esta ficha dejaría la
  // cuenta (nutricionistas + auth) huérfana sin forma de volver a entrar al
  // modo personal — de momento se remite a soporte en vez de permitirlo.
  const handleDeleteAccount = async () => {
    toast('Para eliminar tu cuenta por completo, escríbenos — no se puede deshacer solo desde aquí.', 'warn')
  }

  if (client === undefined) return null
  if (client === null) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-center">
      <p className="text-muted text-sm">No hemos encontrado tu ficha. Escríbenos si el problema persiste.</p>
    </div>
  )

  // heightCm null es la señal de "todavía no ha rellenado sus datos" — se
  // pide una vez por sesión de navegador como mucho ("Ahora no" lo salta
  // vía localStorage); si de verdad rellena su altura, no vuelve a salir.
  let skippedThisSession = false
  try { skippedThisSession = localStorage.getItem(`nutrifit-onboarding-skipped-${client.id}`) === '1' } catch { /* localStorage puede fallar en privado */ }
  if (client.heightCm == null && !skippedThisSession && !onboardingDone) {
    return (
      <PersonalOnboarding client={client} nutricionistaId={userProfile.uid}
        onUpdate={handleUpdate} onDone={() => setOnboardingDone(true)} />
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-serif font-bold text-lg">Nutri<span className="text-accent italic">Fit</span></span>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><InstallAppButton variant="link" /></div>
            <ThemeToggle />
            <button onClick={onLogout} className="p-2 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto">
        {/* Montadas siempre, solo ocultas con CSS — mismo motivo que en
            ClientPanel/ClientView: cambiar de pestaña no debe borrar una
            edición a medio hacer en el plan. */}
        <div className={tab === 'hoy' ? '' : 'hidden'}><HoyTab client={client} personalMode /></div>
        <div className={tab === 'dieta' ? '' : 'hidden'}><DietaClienteTab client={client} personalMode /></div>
        <div className={tab === 'progreso' ? '' : 'hidden'}>
          <ProgresoClienteTab client={client} nutricionistaLogoUrl={userProfile.logoUrl} nutricionistaAccentColor={userProfile.accentColor} personalMode />
        </div>
        <div className={tab === 'plan' ? '' : 'hidden'} style={{ padding: '2rem 1.5rem' }}>
          <PlanDietaTab client={client} nutricionistaId={userProfile.uid} nutricionistaName={userProfile.displayName}
            nutricionistaLogoUrl={userProfile.logoUrl} nutricionistaAccentColor={userProfile.accentColor} personalMode />
        </div>
        <div className={tab === 'perfil' ? '' : 'hidden'} style={{ padding: '2rem 1.5rem' }}>
          <div className="max-w-lg mb-6">
            {/* Editable — el "Cuestionario de salud" de PerfilTab, más
                abajo, solo enseña un resumen de solo lectura de estas
                mismas respuestas (pensado para que el nutricionista
                revise las del cliente, no para rellenarlas). */}
            <AnamnesisForm clientId={client.id} nutricionistaId={userProfile.uid} personalMode />
          </div>
          <PerfilTab client={client} onUpdate={handleUpdate} onRegenerateToken={handleRegenerateToken}
            onDelete={handleDeleteAccount} nutricionistaName={userProfile.displayName}
            customQuestions={userProfile.customAnamnesisQuestions} hasConsentDocument={!!userProfile.consentDocumentUrl} personalMode />
        </div>
      </main>
    </div>
  )
}
