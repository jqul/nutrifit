import { useState, useEffect } from 'react'
import { Home, Utensils, BarChart2, MoreHorizontal, MessageCircle } from 'lucide-react'
import { buildWAUrl } from '../../lib/whatsapp'
import { ClientData, DietPlan, WeightEntry, DailyCheckin, ProgressPhotoSession, MealLog, ClinicalNote } from '../../types'
import { BloodMarkerRow, RecipeRow } from '../../lib/supabase-types'
import { ThemeToggle } from '../shared/ThemeToggle'
import { PushToggle } from '../shared/PushToggle'
import { InstallAppButton } from '../shared/InstallAppButton'
import { useInstallPrompt } from '../../lib/useInstallPrompt'
import { HoyTab } from './HoyTab'
import { DietaClienteTab } from './DietaClienteTab'
import { ProgresoClienteTab } from './ProgresoClienteTab'
import { AnamnesisForm } from './AnamnesisForm'
import { ChangePasswordCard } from '../shared/ChangePasswordCard'
import { useAccentOverride } from '../../lib/useAccentOverride'
import { supabase } from '../../lib/supabase'

type Tab = 'hoy' | 'dieta' | 'progreso' | 'mas'

interface DemoProgresoData {
  weights: WeightEntry[]; checkins: DailyCheckin[]; photos: ProgressPhotoSession[]; mealLogs: MealLog[]
  bloodMarkers?: BloodMarkerRow[]; clinicalNotes?: ClinicalNote[]
}

/**
 * El "shell" completo de la app del cliente (cabecera + tabs + nav
 * inferior) — extraído de ClientView.tsx para poder reutilizarlo tal
 * cual tanto ahí (cliente real autenticado por token, o demo pública)
 * como en TrainerClientPreview.tsx (el nutricionista viendo su propia
 * app "como la ve el cliente", con los datos reales de ESE cliente
 * cargados como si fueran "demo" — mismo mecanismo de solo-lectura que
 * ya usa el modo demo, sin tener que auditar cada escritura de cada tab
 * una por una para bloquearla aparte).
 */
export function ClientAppShell({
  clientData, demoMode, bannerText, nutricionistaName, logoUrl, accentColor, contactPhone,
  demoPlan, demoRecipes, demoData, previewMode, onSignOut,
}: {
  clientData: ClientData
  demoMode: boolean
  bannerText?: string
  nutricionistaName: string
  logoUrl: string | null
  accentColor: string | null
  contactPhone: string | null
  demoPlan?: DietPlan | null
  demoRecipes?: RecipeRow[]
  demoData?: DemoProgresoData
  // El nutricionista viendo su propia app como la ve el cliente — oculta
  // las acciones de sesión/cuenta que no aplican (cerrar sesión, cambiar
  // contraseña, notificaciones push) porque no hay una sesión de cliente
  // real detrás.
  previewMode?: boolean
  // Maneja el ref de "estoy cerrando sesión" y el authState del lado del
  // cliente real (ClientView) — vive fuera de este shell porque
  // TrainerClientPreview no tiene ninguno de los dos.
  onSignOut?: () => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('hoy')
  useAccentOverride(accentColor)

  const clientName = `${clientData.name} ${clientData.surname}`.trim()

  const TABS: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'hoy', icon: Home, label: 'Hoy' },
    { id: 'dieta', icon: Utensils, label: 'Dieta' },
    { id: 'progreso', icon: BarChart2, label: 'Progreso' },
    { id: 'mas', icon: MoreHorizontal, label: 'Más' },
  ]

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-bg">
      {bannerText && (
        <div className="bg-accent/10 text-accent text-center text-xs font-semibold py-1.5 flex-shrink-0 z-20">
          {bannerText}
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
          <HoyTab client={clientData} demoMode={demoMode} />
        </div>
        <div className={activeTab === 'dieta' ? '' : 'hidden'}>
          <DietaClienteTab client={clientData} demoMode={demoMode} demoPlan={demoPlan ?? undefined} demoRecipes={demoRecipes} />
        </div>
        <div className={activeTab === 'progreso' ? '' : 'hidden'}>
          <ProgresoClienteTab client={clientData} demoMode={demoMode} demoData={demoData}
            nutricionistaLogoUrl={logoUrl} nutricionistaAccentColor={accentColor} nutricionistaName={nutricionistaName} />
        </div>
        {activeTab === 'mas' && (
          <div className="px-4 py-6 space-y-4 max-w-xl mx-auto pb-24">
            <h3 className="font-serif font-bold text-xl">Más opciones</h3>
            <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{previewMode ? 'Ficha del cliente' : 'Tu cuenta'}</p>
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
            {!previewMode && (
              <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Notificaciones</p>
                  <p className="text-xs text-muted">Avisos cuando tu nutricionista actualice tu plan o confirme una cita</p>
                </div>
                <PushToggle clientId={demoMode ? undefined : clientData.id} />
              </div>
            )}
            <InstallAppCard />
            {previewMode ? (
              <AnamnesisPreview clientId={clientData.id} />
            ) : (
              <AnamnesisForm clientId={clientData.id} nutricionistaId={clientData.nutricionistaId} demoMode={demoMode} />
            )}
            {!demoMode && !previewMode && <ChangePasswordCard />}
            {previewMode && (
              <p className="text-xs text-muted text-center px-4">Estás viendo esta pantalla como el nutricionista — cerrar sesión, cambiar contraseña y las notificaciones push del cliente no están disponibles en la vista previa.</p>
            )}
            {demoMode && !previewMode && (
              <a href="/" className="block w-full text-center py-3 border border-border rounded-2xl text-sm font-medium text-muted hover:bg-bg-alt transition-colors">
                Volver al inicio
              </a>
            )}
            {!demoMode && !previewMode && onSignOut && (
              <SignOutButton onSignOut={onSignOut} />
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

/** Se oculta sola (vía useInstallPrompt) si ya está instalada o si el
 * navegador no ofrece ninguna vía — así el bloque entero, no solo el
 * botón, desaparece de "Más" en vez de dejar una tarjeta vacía. */
function InstallAppCard() {
  const { show } = useInstallPrompt()
  if (!show) return null
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">Instalar app</p>
        <p className="text-xs text-muted">Añade NutriFit a tu pantalla de inicio, como una app</p>
      </div>
      <InstallAppButton />
    </div>
  )
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button onClick={onSignOut}
      className="w-full py-3 border border-border rounded-2xl text-sm font-medium text-muted hover:bg-bg-alt transition-colors">
      Cerrar sesión
    </button>
  )
}

/** Resumen de solo lectura del cuestionario de salud para la vista previa
 * del nutricionista — a diferencia de AnamnesisForm (pensado para que lo
 * rellene el cliente), aquí solo hace falta mostrar si ya está completo,
 * sin exponer un formulario editable con escrituras reales. */
function AnamnesisPreview({ clientId }: { clientId: string }) {
  const [completedAt, setCompletedAt] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    supabase.from('anamnesis').select('completed_at').eq('client_id', clientId).maybeSingle()
      .then(({ data }) => setCompletedAt(data?.completed_at ?? null))
  }, [clientId])

  if (completedAt === undefined) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-sm font-semibold mb-1">Cuestionario de salud</p>
      <p className="text-xs text-muted">
        {completedAt ? `El cliente lo completó el ${new Date(completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'El cliente todavía no lo ha completado.'}
      </p>
    </div>
  )
}
