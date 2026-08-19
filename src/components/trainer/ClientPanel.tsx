import { useState } from 'react'
import { UserProfile, ClientData } from '../../types'
import { useNutricionistaClients } from '../../hooks/useNutricionistaClients'
import { PerfilTab } from './client-panel/PerfilTab'
import { NotasTab } from './client-panel/NotasTab'
import { PlanDietaTab } from './client-panel/PlanDietaTab'
import { SeguimientoTab } from './client-panel/SeguimientoTab'
import { MensajesTab } from './client-panel/MensajesTab'
import { AnaliticasTab } from './client-panel/AnaliticasTab'
import { ThemeToggle } from '../shared/ThemeToggle'
import { ArrowLeft } from 'lucide-react'
import { DEMO_DIET_PLANS, DEMO_WEIGHTS, DEMO_CHECKINS, DEMO_PHOTOS, DEMO_MEAL_LOGS, DEMO_BLOOD_MARKERS } from '../../lib/demo-data'

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
  const { updateClient, regenerateToken, deleteClient } = useNutricionistaClients({
    nutricionistaId: userProfile.uid, demoClients: demoMode ? [current] : undefined,
  })

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
          <ThemeToggle />
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
        {tab === 'perfil' && (
          <PerfilTab client={current} onUpdate={handleUpdate} onRegenerateToken={handleRegenerateToken}
            onDelete={handleDelete} demoMode={demoMode} nutricionistaName={userProfile.displayName}
            customQuestions={userProfile.customAnamnesisQuestions} />
        )}
        {tab === 'dieta' && (
          <PlanDietaTab client={current} nutricionistaId={userProfile.uid} nutricionistaName={userProfile.displayName}
            nutricionistaLogoUrl={userProfile.logoUrl} nutricionistaAccentColor={userProfile.accentColor}
            demoPlan={demoMode ? DEMO_DIET_PLANS[current.id] : undefined} />
        )}
        {tab === 'seguimiento' && (
          <SeguimientoTab client={current} demoData={demoMode ? {
            weights: DEMO_WEIGHTS[current.id] || [],
            checkins: DEMO_CHECKINS[current.id] || [],
            photos: DEMO_PHOTOS[current.id] || [],
            mealLogs: DEMO_MEAL_LOGS[current.id] || [],
          } : undefined} />
        )}
        {tab === 'analiticas' && (
          <AnaliticasTab client={current} demoMode={demoMode} demoMarkers={demoMode ? (DEMO_BLOOD_MARKERS[current.id] || []) : undefined} />
        )}
        {tab === 'mensajes' && (
          <MensajesTab client={current} nutricionistaId={userProfile.uid} onUpdate={handleUpdate} demoMode={demoMode} />
        )}
        {tab === 'notas' && <NotasTab client={current} onUpdate={handleUpdate} />}
      </main>
    </div>
  )
}
