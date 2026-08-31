import { useState, useEffect } from 'react'
import { UserProfile, ClientData } from '../../types'
import { useNutricionistaClients, NewClientInput } from '../../hooks/useNutricionistaClients'
import { goalLabel } from '../../lib/constants'
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/date'
import { DEMO_APPOINTMENTS } from '../../lib/demo-data'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'
import { ThemeToggle } from '../shared/ThemeToggle'
import { PushToggle } from '../shared/PushToggle'
import { InstallAppButton } from '../shared/InstallAppButton'
import { GoalSelect } from '../shared/GoalSelect'
import { CalendarTab } from './CalendarTab'
import { BusinessDashboard } from './BusinessDashboard'
import { ConversorTab } from './ConversorTab'
import { MicronutrientesTab } from './MicronutrientesTab'
import { PlantillasTab } from './PlantillasTab'
import { AjustesTab } from './AjustesTab'
import { DifusionTab } from './DifusionTab'
import { ImportClientsModal } from './ImportClientsModal'
import { Plus, Flame, Copy, LogOut, Search, Crown, Upload, ShieldCheck, AlertTriangle, Receipt, CheckCircle2, CalendarClock, Tag } from 'lucide-react'
import { ClientHealthStatus } from '../../lib/clientHealth'
import { toast } from '../shared/Toast'

const EMPTY_FORM: NewClientInput = {
  name: '', surname: '', phone: '', email: '', goal: '', heightCm: '', gender: '', birthDate: '', allergies: '',
}

// Badge de salud del cliente ("semáforo"): un icono + color por estado, para
// escanear la lista de un vistazo y ver quién necesita atención — ver
// computeClientHealth para la prioridad entre estados.
const HEALTH_BADGE: Record<ClientHealthStatus, { icon: typeof AlertTriangle; className: string }> = {
  attention: { icon: AlertTriangle, className: 'text-warn bg-warn/10 border-warn/20' },
  billing: { icon: Receipt, className: 'text-notice bg-notice/10 border-notice/20' },
  streak: { icon: Flame, className: 'text-accent bg-accent/10 border-accent/20' },
  active: { icon: CheckCircle2, className: 'text-ok bg-ok/10 border-ok/20' },
}

type View = 'clientes' | 'calendario' | 'negocio' | 'conversor' | 'micronutrientes' | 'plantillas' | 'difusion' | 'ajustes'
const VIEWS: { id: View; label: string }[] = [
  { id: 'clientes', label: 'Clientes' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'negocio', label: 'Negocio' },
  { id: 'conversor', label: 'Conversor' },
  { id: 'micronutrientes', label: 'Micronutrientes' },
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'difusion', label: 'Difusión' },
  { id: 'ajustes', label: 'Ajustes' },
]

export function NutricionistaDashboard({ userProfile, onLogout, onSelectClient, demoClients, onUpdateProfile, onSwitchToAdmin }: {
  userProfile: UserProfile
  onLogout: () => void
  onSelectClient: (client: ClientData) => void
  demoClients?: ClientData[]
  onUpdateProfile: (updates: Partial<UserProfile>) => void
  onSwitchToAdmin?: () => void
}) {
  const { clients, loading, addClient, fetchClients } = useNutricionistaClients({ nutricionistaId: userProfile.uid, demoClients })
  const [view, setView] = useState<View>('clientes')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState<NewClientInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  // 'all' | 'risk' | 'today' | `tag:${nombre}` — filtro rápido de la lista,
  // se combina con la búsqueda por texto (ambos deben cumplirse).
  const [quickFilter, setQuickFilter] = useState('all')
  const [todayApptClientIds, setTodayApptClientIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const todayStr = toLocalISODate(new Date())
    if (demoClients) {
      const ids = new Set(
        DEMO_APPOINTMENTS.filter(a => a.clientId && toLocalISODate(new Date(a.startAt)) === todayStr && a.status !== 'cancelada')
          .map(a => a.clientId as string)
      )
      setTodayApptClientIds(ids)
      return
    }
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    supabase.from('appointments').select('client_id')
      .eq('nutricionista_id', userProfile.uid).neq('status', 'cancelada')
      .gte('start_at', start.toISOString()).lte('start_at', end.toISOString())
      .then(({ data }) => setTodayApptClientIds(new Set((data || []).map((r: { client_id: string }) => r.client_id).filter(Boolean))))
  }, [userProfile.uid, demoClients])

  const allTags = Array.from(new Set(clients.flatMap(c => c.tags))).sort()
  const riskCount = clients.filter(c => c.healthStatus === 'attention').length

  const filtered = clients
    .filter(c => `${c.name} ${c.surname}`.toLowerCase().includes(query.toLowerCase()))
    .filter(c => {
      if (quickFilter === 'all') return true
      if (quickFilter === 'risk') return c.healthStatus === 'attention'
      if (quickFilter === 'today') return todayApptClientIds.has(c.id)
      if (quickFilter.startsWith('tag:')) return c.tags.includes(quickFilter.slice(4))
      return true
    })
  const topStreak = Math.max(0, ...clients.map(c => c.streak || 0))

  const handleCreate = async () => {
    if (!form.name.trim()) { toast('Introduce el nombre del cliente', 'warn'); return }
    setSaving(true)
    const ok = await addClient(form)
    setSaving(false)
    if (ok) { setModalOpen(false); setForm(EMPTY_FORM) }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/?c=${token}`
    navigator.clipboard.writeText(url)
    toast('Enlace copiado ✓', 'ok')
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          {userProfile.logoUrl ? (
            <div className="flex items-center gap-2">
              <img src={userProfile.logoUrl} alt={userProfile.displayName} className="w-8 h-8 rounded-full object-cover" />
              <span className="font-serif font-bold hidden sm:inline">{userProfile.displayName}</span>
            </div>
          ) : (
            <span className="text-xl font-serif font-bold">Nutri<span className="text-accent italic">Fit</span></span>
          )}
          <div className="flex items-center gap-2">
            {onSwitchToAdmin && (
              <button onClick={onSwitchToAdmin}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-bg-alt transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </button>
            )}
            <div className="hidden sm:block"><InstallAppButton variant="link" /></div>
            <PushToggle nutricionistaId={demoClients ? undefined : userProfile.uid} />
            <ThemeToggle />
            <span className="text-sm text-muted hidden sm:inline">{userProfile.displayName}</span>
            <button onClick={onLogout} className="p-2 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                view === v.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}>
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Estas pestañas se quedan montadas siempre y solo se ocultan con
            CSS (en vez de desmontarse con &&) — si no, cada vez que sales
            (a Clientes, a otra pestaña...) el componente pierde su estado
            interno entero: la búsqueda del Conversor, el alimento
            seleccionado, el formulario a medio rellenar... */}
        <div className={view === 'calendario' ? '' : 'hidden'}>
          <CalendarTab nutricionistaId={userProfile.uid} clients={clients} demoMode={!!demoClients} />
        </div>
        <div className={view === 'negocio' ? '' : 'hidden'}>
          <BusinessDashboard clients={clients} />
        </div>
        <div className={view === 'conversor' ? '' : 'hidden'}>
          <ConversorTab nutricionistaId={userProfile.uid} demoMode={!!demoClients} />
        </div>
        <div className={view === 'micronutrientes' ? '' : 'hidden'}>
          <MicronutrientesTab />
        </div>
        <div className={view === 'plantillas' ? '' : 'hidden'}>
          <PlantillasTab nutricionistaId={userProfile.uid} demoMode={!!demoClients} />
        </div>
        <div className={view === 'difusion' ? '' : 'hidden'}>
          <DifusionTab clients={clients} nutricionistaId={userProfile.uid} demoMode={!!demoClients} />
        </div>
        <div className={view === 'ajustes' ? '' : 'hidden'}>
          <AjustesTab userProfile={userProfile} demoMode={!!demoClients} onUpdateProfile={onUpdateProfile} />
        </div>
        {view === 'clientes' && (
          <>
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <h1 className="text-2xl font-serif font-bold">Clientes</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4" /> Importar CSV/Excel</Button>
                <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Nuevo cliente</Button>
              </div>
            </div>

            {clients.length > 0 && (
              <div className="space-y-3 mb-5">
                <div className="relative max-w-sm">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente..."
                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <FilterChip active={quickFilter === 'all'} onClick={() => setQuickFilter('all')} label="Todos" />
                  <FilterChip active={quickFilter === 'risk'} onClick={() => setQuickFilter('risk')} label={`En riesgo${riskCount > 0 ? ` (${riskCount})` : ''}`} icon={AlertTriangle} />
                  <FilterChip active={quickFilter === 'today'} onClick={() => setQuickFilter('today')} label={`Con cita hoy${todayApptClientIds.size > 0 ? ` (${todayApptClientIds.size})` : ''}`} icon={CalendarClock} />
                  {allTags.map(t => (
                    <FilterChip key={t} active={quickFilter === `tag:${t}`} onClick={() => setQuickFilter(`tag:${t}`)} label={t} icon={Tag} />
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-muted text-sm">Cargando...</p>
            ) : filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <p className="text-muted text-sm">
                  {clients.length === 0 ? 'Todavía no tienes clientes. Crea el primero para empezar.' : 'Ningún cliente coincide con el filtro.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(c => {
                  const isTopStreak = topStreak > 0 && (c.streak || 0) === topStreak
                  const badge = HEALTH_BADGE[c.healthStatus || 'active']
                  const BadgeIcon = badge.icon
                  return (
                  <div key={c.id} className={`bg-card border rounded-2xl p-5 hover:shadow-sm transition-all cursor-pointer ${
                    isTopStreak ? 'border-accent/50' : 'border-border hover:border-accent/40'
                  }`}
                    onClick={() => onSelectClient(c)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-serif font-bold text-lg flex items-center gap-1.5">
                          {c.name} {c.surname}
                          {isTopStreak && <Crown className="w-4 h-4 text-accent flex-shrink-0" aria-label="Mejor racha" />}
                        </p>
                        {c.goal && <p className="text-xs text-muted mt-0.5">{goalLabel(c.goal)}</p>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); copyLink(c.token) }}
                        className="p-1.5 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors flex-shrink-0" title="Copiar enlace del cliente">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-1 text-muted">
                        <Flame className={`w-3.5 h-3.5 ${(c.streak || 0) > 0 ? 'text-accent' : ''}`} />
                        <span>{c.streak || 0}d</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-1.5 bg-bg-alt rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${c.adherence7d || 0}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-muted">{c.adherence7d || 0}%</span>
                    </div>
                    <div className={`inline-flex items-center gap-1 mt-3 px-2 py-1 rounded-lg border text-xs font-semibold ${badge.className}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {c.healthLabel || 'Activo'}
                    </div>
                  </div>
                )})}
              </div>
            )}
          </>
        )}
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo cliente">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nombre</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Apellidos</label>
              <input value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          </div>
          <GoalSelect value={form.goal} onChange={goal => setForm({ ...form, goal })} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Altura (cm)</label>
              <input type="number" value={form.heightCm} onChange={e => setForm({ ...form, heightCm: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Género</label>
              <input value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nacimiento</label>
              <input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Alergias / intolerancias</label>
            <textarea value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} rows={2}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none" />
          </div>
          <Button onClick={handleCreate} loading={saving} className="w-full">Crear cliente</Button>
        </div>
      </Modal>

      <ImportClientsModal open={importOpen} onClose={() => setImportOpen(false)} nutricionistaId={userProfile.uid}
        demoMode={!!demoClients} onImported={fetchClients} />
    </div>
  )
}

function FilterChip({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon?: typeof AlertTriangle }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
      }`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  )
}
