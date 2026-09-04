import { useState, useEffect } from 'react'
import { UserProfile, ClientData } from '../../types'
import { useNutricionistaClients } from '../../hooks/useNutricionistaClients'
import { supabase } from '../../lib/supabase'
import { PerfilTab } from './client-panel/PerfilTab'
import { NotasTab } from './client-panel/NotasTab'
import { PlanDietaTab } from './client-panel/PlanDietaTab'
import { SeguimientoTab } from './client-panel/SeguimientoTab'
import { MensajesTab } from './client-panel/MensajesTab'
import { AnaliticasTab } from './client-panel/AnaliticasTab'
import { ClientSidebar } from './client-panel/ClientSidebar'
import { TrainerClientPreview } from './TrainerClientPreview'
import { ThemeToggle } from '../shared/ThemeToggle'
import { ArrowLeft, Smartphone } from 'lucide-react'
import { DEMO_DIET_PLANS, DEMO_WEIGHTS, DEMO_CHECKINS, DEMO_PHOTOS, DEMO_MEAL_LOGS, DEMO_BLOOD_MARKERS, DEMO_CLINICAL_NOTES } from '../../lib/demo-data'

type Tab = 'perfil' | 'dieta' | 'seguimiento' | 'analiticas' | 'mensajes' | 'notas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'dieta', label: 'Plan de dieta' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'analiticas', label: 'Analíticas' },
  { id: 'mensajes', label: 'Mensajes' },
  { id: 'notas', label: 'Notas' },
]

export function ClientPanel({ client, userProfile, onClose, demoMode }: {
  client: ClientData
  userProfile: UserProfile
  onClose: () => void
  demoMode?: boolean
}) {
  const [tab, setTab] = useState<Tab>('perfil')
  const [current, setCurrent] = useState(client)
  const [previewing, setPreviewing] = useState(false)
  const { updateClient, regenerateToken, deleteClient } = useNutricionistaClients({
    nutricionistaId: userProfile.uid, demoClients: demoMode ? [current] : undefined,
  })
  // Peso actual para la barra lateral (ClientSidebar) — mismo dato que carga
  // PerfilTab por su cuenta para su propia ficha; se duplica aquí a
  // propósito para que la barra lateral no dependa de qué pestaña esté
  // activa (PerfilTab puede estar montado-pero-oculto sin haber cargado
  // nada todavía la primera vez).
  const [sidebarWeight, setSidebarWeight] = useState<number | null>(null)
  useEffect(() => {
    if (demoMode) {
      const entries = DEMO_WEIGHTS[current.id] || []
      setSidebarWeight(entries.length ? entries[entries.length - 1].weightKg : null)
      return
    }
    supabase.from('weight_logs').select('weight_kg').eq('client_id', current.id).order('date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setSidebarWeight(data?.weight_kg ?? null))
  }, [current.id, demoMode])

  const handleUpdate = async (updates: Partial<ClientData>) => {
    const ok = await updateClient(current.id, updates)
    if (ok) setCurrent({ ...current, ...updates })
    return ok
  }

  const handleRegenerateToken = async () => {
    const token = await regenerateToken(current.id)
    if (token) setCurrent({ ...current, token })
    return token
  }

  const handleDelete = async () => {
    const ok = await deleteClient(current.id)
    if (ok) onClose()
  }

  if (previewing) {
    return <TrainerClientPreview client={current} userProfile={userProfile} demoMode={demoMode} onClose={() => setPreviewing(false)} />
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-serif font-bold text-lg">{current.name} {current.surname}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreviewing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted hover:text-ink hover:bg-bg-alt transition-colors">
              <Smartphone className="w-3.5 h-3.5" /> Vista previa cliente
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="lg:flex lg:gap-8 lg:items-start">
          <aside className="mb-6 lg:mb-0 lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-24">
            <ClientSidebar client={current} currentWeight={sidebarWeight} />
          </aside>
          <div className="flex-1 min-w-0">
            {/* Montadas siempre, solo ocultas con CSS — si no, cambiar de
                pestaña (ej. a Notas y volver) borra cualquier edición del plan
                de dieta que no se hubiera guardado todavía. */}
            <div className={tab === 'perfil' ? '' : 'hidden'}>
              <PerfilTab client={current} onUpdate={handleUpdate} onRegenerateToken={handleRegenerateToken}
                onDelete={handleDelete} demoMode={demoMode} nutricionistaName={userProfile.displayName}
                customQuestions={userProfile.customAnamnesisQuestions} hasConsentDocument={!!userProfile.consentDocumentUrl} />
            </div>
            <div className={tab === 'dieta' ? '' : 'hidden'}>
              <PlanDietaTab client={current} nutricionistaId={userProfile.uid} nutricionistaName={userProfile.displayName}
                nutricionistaLogoUrl={userProfile.logoUrl} nutricionistaAccentColor={userProfile.accentColor}
                demoPlan={demoMode ? DEMO_DIET_PLANS[current.id] : undefined} />
            </div>
            <div className={tab === 'seguimiento' ? '' : 'hidden'}>
              <SeguimientoTab client={current} onUpdate={handleUpdate} nutricionistaLogoUrl={userProfile.logoUrl} nutricionistaAccentColor={userProfile.accentColor}
                nutricionistaName={userProfile.displayName}
                demoData={demoMode ? {
                  weights: DEMO_WEIGHTS[current.id] || [],
                  checkins: DEMO_CHECKINS[current.id] || [],
                  photos: DEMO_PHOTOS[current.id] || [],
                  mealLogs: DEMO_MEAL_LOGS[current.id] || [],
                  bloodMarkers: DEMO_BLOOD_MARKERS[current.id] || [],
                  clinicalNotes: DEMO_CLINICAL_NOTES[current.id] || [],
                } : undefined} />
            </div>
            <div className={tab === 'analiticas' ? '' : 'hidden'}>
              <AnaliticasTab client={current} demoMode={demoMode} demoMarkers={demoMode ? (DEMO_BLOOD_MARKERS[current.id] || []) : undefined} />
            </div>
            <div className={tab === 'mensajes' ? '' : 'hidden'}>
              <MensajesTab client={current} nutricionistaId={userProfile.uid} onUpdate={handleUpdate} demoMode={demoMode} />
            </div>
            <div className={tab === 'notas' ? '' : 'hidden'}>
              <NotasTab client={current} onUpdate={handleUpdate} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
