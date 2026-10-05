import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { Appointment } from '../../types'
import { ClientWithStats } from '../../hooks/useNutricionistaClients'
import { attentionList, goalReachedClients, greeting, monthlyRevenue, summarizePriorities, Priority, ClientPanelTab } from '../../lib/controlCenter'
import { Button } from '../shared/Button'

const MAX_ATTENTION = 6

// Qué se hace al abrir la ficha desde un aviso: lo dice el botón de la derecha.
const TAB_ACTION: Record<ClientPanelTab, string> = {
  perfil: 'Ver ficha', dieta: 'Ver plan', seguimiento: 'Ver seguimiento', analiticas: 'Ver analítica', mensajes: 'Escribir', notas: 'Ver notas',
}

const PRIORITY_STYLE: Record<Priority, { dot: string; label: string }> = {
  today: { dot: 'bg-warn', label: 'Actuar hoy' },
  week: { dot: 'bg-notice', label: 'Revisar esta semana' },
  ok: { dot: 'bg-ok', label: 'Todo correcto' },
}

/**
 * Centro de control: lo primero que ve el nutricionista. Responde a "¿qué
 * necesita mi atención ahora?" antes que a "¿qué clientes tengo?": prioridades,
 * citas de hoy, quién necesita algo y una línea de negocio.
 */
export function ControlCenter({ displayName, clients, loading, todayAppointments, onOpenClient, onShowClients, onGoToCalendar, onGoToBusiness, onNewClient }: {
  displayName: string
  clients: ClientWithStats[]
  loading: boolean
  todayAppointments: Appointment[]
  /** Abre la ficha; si se indica pestaña, directamente en ella. */
  onOpenClient: (client: ClientWithStats, tab?: ClientPanelTab) => void
  /** Lleva a la lista de Clientes con ese filtro rápido ('all' | 'risk'). */
  onShowClients: (filter: 'all' | 'risk') => void
  onGoToCalendar: () => void
  onGoToBusiness: () => void
  onNewClient: () => void
}) {
  const now = new Date()
  const summary = useMemo(() => summarizePriorities(clients), [clients])
  const attention = useMemo(() => attentionList(clients), [clients])
  const reached = useMemo(() => goalReachedClients(clients), [clients])
  const revenue = useMemo(() => monthlyRevenue(clients), [clients])
  const clientName = (id: string | null) => {
    const c = id ? clients.find(x => x.id === id) : null
    return c ? `${c.name} ${c.surname}`.trim() : null
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  const today = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">{greeting(now, displayName)}</h1>
        <p className="text-sm text-muted mt-1 first-letter:uppercase">{today}</p>
      </div>

      {clients.length === 0 ? (
        <div className="card p-10 text-center space-y-4">
          <p className="text-muted text-sm">Todavía no tienes clientes. Crea el primero para empezar a ver aquí su estado.</p>
          <Button onClick={onNewClient}>Nuevo cliente</Button>
        </div>
      ) : (
        <>
          <div className="card-featured p-6">
            <p className="font-serif font-bold text-5xl leading-none">
              {summary.total}<span className="font-sans text-base font-medium text-muted ml-2">{summary.total === 1 ? 'cliente' : 'clientes'}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {(['today', 'week', 'ok'] as const).map(p => (
                <button key={p} onClick={() => onShowClients(p === 'ok' ? 'all' : 'risk')}
                  className="text-left rounded-xl p-2 hover:bg-card/60 transition-colors">
                  <p className="font-serif font-bold text-2xl leading-none">{summary[p]}</p>
                  <p className="text-xs text-muted mt-1.5 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_STYLE[p].dot}`} /> {PRIORITY_STYLE[p].label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <section aria-labelledby="cc-today">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h2 id="cc-today" className="text-sm font-semibold">Para hoy</h2>
                <button onClick={onGoToCalendar} className="text-xs font-semibold text-accent">Calendario</button>
              </div>
              {todayAppointments.length === 0 ? (
                <div className="card p-5"><p className="text-sm text-muted">No tienes citas hoy.</p></div>
              ) : (
                <div className="card divide-y divide-border/60">
                  {todayAppointments.map(a => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <p className="font-serif font-bold text-lg leading-tight w-14 flex-shrink-0">
                        {new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{a.title}</p>
                        {clientName(a.clientId) && <p className="text-xs text-muted">{clientName(a.clientId)}</p>}
                        {a.status === 'pendiente' && <p className="text-xs font-semibold text-warn">Pendiente de confirmar</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="cc-attention">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h2 id="cc-attention" className="text-sm font-semibold">Requieren atención</h2>
                {attention.length > MAX_ATTENTION && (
                  <button onClick={() => onShowClients('risk')} className="text-xs font-semibold text-accent">Ver todos ({attention.length})</button>
                )}
              </div>
              {attention.length === 0 ? (
                <div className="card p-5"><p className="text-sm text-muted">Nadie necesita atención ahora mismo. Todo en orden.</p></div>
              ) : (
                <div className="card divide-y divide-border/60 overflow-hidden">
                  {attention.slice(0, MAX_ATTENTION).map(({ client: c, priority, issues }) => {
                    const first = issues[0]
                    return (
                      <button key={c.id} onClick={() => onOpenClient(c, first.tab)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-alt/60 transition-colors">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_STYLE[priority].dot}`} aria-label={PRIORITY_STYLE[priority].label} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{c.name} {c.surname}</span>
                          <span className="block text-xs text-muted">
                            {issues.slice(0, 2).map(i => i.label).join(' · ')}
                            {issues.length > 2 && ` · +${issues.length - 2}`}
                          </span>
                        </span>
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-accent flex-shrink-0">
                          {TAB_ACTION[first.tab]} <ChevronRight className="w-4 h-4" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          {reached.length > 0 && (
            <section aria-labelledby="cc-goals">
              <h2 id="cc-goals" className="text-sm font-semibold mb-2">Objetivos alcanzados</h2>
              <div className="card divide-y divide-border/60">
                {reached.map(c => (
                  <button key={c.id} onClick={() => onOpenClient(c, 'seguimiento')}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-alt/60 transition-colors">
                    <span className="text-sm font-semibold truncate">{c.name} {c.surname}</span>
                    <span className="text-xs font-semibold text-ok flex-shrink-0">Objetivo alcanzado</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="cc-business">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 id="cc-business" className="text-sm font-semibold">Negocio</h2>
              <button onClick={onGoToBusiness} className="text-xs font-semibold text-accent">Ver detalle</button>
            </div>
            <div className="card p-5 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="font-serif font-bold text-3xl leading-none">{revenue.total.toLocaleString('es-ES')} €<span className="font-sans text-sm font-medium text-muted"> / mes</span></p>
                <p className="text-xs text-muted mt-1.5">Ingresos estimados</p>
              </div>
              {revenue.withoutPrice > 0 && (
                <p className="text-xs text-muted">{revenue.withoutPrice} {revenue.withoutPrice === 1 ? 'cliente sin precio asignado' : 'clientes sin precio asignado'}</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
