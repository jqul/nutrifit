import { useState, useMemo, useEffect, useRef } from 'react'
import { UserProfile, ClientData } from '../../types'
import { useNutricionistaClients, NewClientInput } from '../../hooks/useNutricionistaClients'
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
import { ClientListRow } from './ClientListRow'
import { ControlCenter } from './ControlCenter'
import { priorityOf, ClientPanelTab } from '../../lib/controlCenter'
import { useTodayAppointments } from '../../hooks/useTodayAppointments'
import { useReviewedThisWeek } from '../../hooks/useClientReviews'
import { sortClients, ClientSort, CLIENT_SORT_LABELS } from '../../lib/clientListSummary'
import { View, NAV_GROUPS, groupOfView, viewForGroup } from '../../lib/dashboardNav'
import { Plus, LogOut, Search, Upload, ShieldCheck, AlertTriangle, CheckCircle2, CalendarClock, Tag, ChevronDown, ChevronRight } from 'lucide-react'
import { bajaReasonLabel } from '../../lib/clientBaja'
import { toast } from '../shared/Toast'
import { useHasDietPlan } from '../../hooks/useHasDietPlan'
import { onboardingSteps, OnboardingStepId } from '../../lib/onboarding'

const EMPTY_FORM: NewClientInput = {
  name: '', surname: '', phone: '', email: '', goal: '', heightCm: '', gender: '', birthDate: '', allergies: '',
}

export function NutricionistaDashboard({ userProfile, onLogout, onSelectClient, demoClients, onUpdateProfile, onSwitchToAdmin }: {
  userProfile: UserProfile
  onLogout: () => void
  onSelectClient: (client: ClientData, tab?: ClientPanelTab) => void
  demoClients?: ClientData[]
  onUpdateProfile: (updates: Partial<UserProfile>) => void
  onSwitchToAdmin?: () => void
}) {
  const { clients, bajas, loading, addClient, fetchClients } = useNutricionistaClients({ nutricionistaId: userProfile.uid, demoClients })
  const hasPlan = useHasDietPlan(userProfile.uid, !demoClients)
  const [view, setView] = useState<View>('inicio')
  // Última sección vista en cada grupo, para que volver a un grupo te deje donde estabas.
  const [lastViewByGroup, setLastViewByGroup] = useState<Partial<Record<string, View>>>({})
  const activeGroup = groupOfView(view)
  const goToView = (next: View) => {
    setView(next)
    setLastViewByGroup(prev => ({ ...prev, [groupOfView(next).id]: next }))
  }
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState<NewClientInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  // 'all' | 'risk' | 'today' | `tag:${nombre}` — filtro rápido de la lista,
  // se combina con la búsqueda por texto (ambos deben cumplirse).
  const [quickFilter, setQuickFilter] = useState('all')
  const [showBajas, setShowBajas] = useState(false)
  const [sortMode, setSortMode] = useState<ClientSort>('atencion')
  const searchRef = useRef<HTMLInputElement>(null)
  // "/" salta a la búsqueda de clientes (como en Notion, GitHub...), salvo que ya se esté escribiendo en un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || view !== 'clientes') return
      const el = document.activeElement
      if (el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])
  const todayAppointments = useTodayAppointments(userProfile.uid, !!demoClients)
  const reviewedClientIds = useReviewedThisWeek(!!demoClients)
  const todayApptClientIds = useMemo(() => new Set(todayAppointments.map(a => a.clientId).filter((id): id is string => !!id)), [todayAppointments])

  const allTags = Array.from(new Set(clients.flatMap(c => c.tags))).sort()
  // "Atención" = lo que el Centro de control marca como actuar hoy o revisar esta semana.
  const needsAttention = (c: typeof clients[number]) => priorityOf(c) !== 'ok'
  const riskCount = clients.filter(needsAttention).length
  const activeCount = clients.length - riskCount

  const filtered = clients
    .filter(c => `${c.name} ${c.surname}`.toLowerCase().includes(query.toLowerCase()))
    .filter(c => {
      if (quickFilter === 'all') return true
      if (quickFilter === 'risk') return needsAttention(c)
      if (quickFilter === 'active') return !needsAttention(c)
      if (quickFilter === 'today') return todayApptClientIds.has(c.id)
      if (quickFilter.startsWith('tag:')) return c.tags.includes(quickFilter.slice(4))
      return true
    })
  const sorted = sortClients(filtered, sortMode)
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
        <nav aria-label="Secciones" className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {NAV_GROUPS.map(g => {
            const active = g.id === activeGroup.id
            return (
              <button key={g.id} onClick={() => goToView(viewForGroup(g, lastViewByGroup))}
                aria-current={active ? 'page' : undefined}
                ref={el => { if (active) el?.scrollIntoView({ inline: 'nearest', block: 'nearest' }) }}
                className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}>
                {g.label}
              </button>
            )
          })}
        </nav>
        {activeGroup.views.length > 1 && (
          <div role="tablist" aria-label={activeGroup.label} className="max-w-5xl mx-auto px-6 py-2 flex gap-2 overflow-x-auto">
            {activeGroup.views.map(v => (
              <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => goToView(v.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                  view === v.id ? 'bg-accent/15 text-ink' : 'text-muted hover:text-ink hover:bg-bg-alt'
                }`}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Estas pestañas se quedan montadas siempre y solo se ocultan con
            CSS (en vez de desmontarse con &&) — si no, cada vez que sales
            (a Clientes, a otra pestaña...) el componente pierde su estado
            interno entero: la búsqueda del Conversor, el alimento
            seleccionado, el formulario a medio rellenar... */}
        <div className={view === 'inicio' ? '' : 'hidden'}>
          <ControlCenter displayName={userProfile.displayName} clients={clients} loading={loading}
            onboarding={demoClients ? undefined : {
              steps: onboardingSteps({
                profileComplete: !!userProfile.displayName.trim() && !!(userProfile.logoUrl || userProfile.contactPhone),
                clientCount: clients.length, hasPlan, anyClientEntered: clients.some(c => !!c.authUserId),
              }),
              onAction: (id: OnboardingStepId) => {
                if (id === 'profile') goToView('ajustes')
                else if (id === 'client' || clients.length === 0) { goToView('clientes'); setModalOpen(true) }
                else if (id === 'plan') onSelectClient(clients[0], 'dieta')
                else onSelectClient(clients.find(c => !c.authUserId) ?? clients[0], 'perfil')
              },
            }}
            todayAppointments={todayAppointments}
            reviewedClientIds={reviewedClientIds}
            onOpenClient={(c, tab) => onSelectClient(c, tab)}
            onShowClients={filter => { setQuickFilter(filter); goToView('clientes') }}
            onGoToCalendar={() => goToView('calendario')}
            onGoToBusiness={() => goToView('negocio')}
            onNewClient={() => { goToView('clientes'); setModalOpen(true) }} />
        </div>
        <div className={view === 'calendario' ? '' : 'hidden'}>
          <CalendarTab nutricionistaId={userProfile.uid} clients={clients} demoMode={!!demoClients} />
        </div>
        <div className={view === 'negocio' ? '' : 'hidden'}>
          <BusinessDashboard clients={clients} bajas={bajas} onOpenClient={(c, tab) => onSelectClient(c, tab)} />
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
                  <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente… (pulsa /)"
                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <FilterChip active={quickFilter === 'all'} onClick={() => setQuickFilter('all')} label={`Todos (${clients.length})`} />
                  <FilterChip active={quickFilter === 'active'} onClick={() => setQuickFilter('active')} label={`Activos (${activeCount})`} icon={CheckCircle2} />
                  <FilterChip active={quickFilter === 'risk'} onClick={() => setQuickFilter('risk')} label={`Atención (${riskCount})`} icon={AlertTriangle} />
                  <FilterChip active={quickFilter === 'today'} onClick={() => setQuickFilter('today')} label={`Con cita hoy${todayApptClientIds.size > 0 ? ` (${todayApptClientIds.size})` : ''}`} icon={CalendarClock} />
                  {allTags.map(t => (
                    <FilterChip key={t} active={quickFilter === `tag:${t}`} onClick={() => setQuickFilter(`tag:${t}`)} label={t} icon={Tag} />
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Ordenar por
                  <select value={sortMode} onChange={e => setSortMode(e.target.value as ClientSort)}
                    className="px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-ink outline-none focus:ring-2 focus:ring-accent/20">
                    {(Object.keys(CLIENT_SORT_LABELS) as ClientSort[]).map(k => <option key={k} value={k}>{CLIENT_SORT_LABELS[k]}</option>)}
                  </select>
                </label>
              </div>
            )}

            {loading ? (
              <p className="text-muted text-sm">Cargando...</p>
            ) : filtered.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-muted text-sm">
                  {clients.length === 0 ? 'Todavía no tienes clientes. Crea el primero para empezar.' : 'Ningún cliente coincide con el filtro.'}
                </p>
              </div>
            ) : (
              <div className="card divide-y divide-border/60 overflow-hidden">
                {sorted.map(c => (
                  <ClientListRow key={c.id} client={c} isTopStreak={topStreak > 0 && (c.streak || 0) === topStreak}
                    onOpen={() => onSelectClient(c)} onCopyLink={() => copyLink(c.token)} />
                ))}
              </div>
            )}

            {bajas.length > 0 && (
              <section aria-labelledby="bajas-list" className="mt-8">
                <button id="bajas-list" onClick={() => setShowBajas(v => !v)} aria-expanded={showBajas}
                  className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
                  <ChevronDown className={`w-4 h-4 transition-transform ${showBajas ? '' : '-rotate-90'}`} /> De baja ({bajas.length})
                </button>
                {showBajas && (
                  <div className="card divide-y divide-border/60 overflow-hidden mt-2">
                    {[...bajas].sort((a, b) => (b.bajaAt ?? 0) - (a.bajaAt ?? 0)).map(c => (
                      <button key={c.id} onClick={() => onSelectClient(c)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-alt/60 transition-colors">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{c.name} {c.surname}</span>
                          <span className="block text-xs text-muted">
                            {new Date(c.bajaAt ?? 0).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} · {bajaReasonLabel(c.bajaReason)}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
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
