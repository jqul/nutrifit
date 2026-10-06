import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ClientWithStats } from '../../hooks/useNutricionistaClients'
import { ClientData } from '../../types'
import { CHURN_WINDOW_DAYS, churnMetrics, formatTenure } from '../../lib/clientBaja'
import { ClientPanelTab } from '../../lib/controlCenter'
import { ACTIVE_WINDOW_DAYS, CohortKey, RiskLevel, cohorts, rankByRisk, retentionMetrics } from '../../lib/retention'

const RISK_DOT: Record<RiskLevel, string> = { high: 'bg-warn', medium: 'bg-notice', low: 'bg-ok' }
const RISK_LABEL: Record<RiskLevel, string> = { high: 'Riesgo alto', medium: 'Riesgo medio', low: 'Sin riesgo' }
const MAX_RISK_ROWS = 8

const eur = (n: number) => `${n.toLocaleString('es-ES')} €`
const pct = (n: number | null, signed = false) => n == null ? '—' : `${signed && n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toString().replace('.', ',')}%`

/**
 * Negocio: cuánto entra al mes, cómo está la retención y a quién hay que cuidar
 * para que no se vaya. La retención se estima por actividad (check-ins y pesajes);
 * las bajas REALES salen de los clientes dados de baja (clientBaja.ts).
 */
export function BusinessDashboard({ clients, bajas = [], onOpenClient }: {
  clients: ClientWithStats[]
  /** Clientes dados de baja (no cuentan en `clients`). */
  bajas?: ClientData[]
  onOpenClient: (client: ClientWithStats, tab?: ClientPanelTab) => void
}) {
  const [cohortBy, setCohortBy] = useState<CohortKey>('goal')
  const [showAllRisk, setShowAllRisk] = useState(false)

  const metrics = useMemo(() => retentionMetrics(clients), [clients])
  const churn = useMemo(() => churnMetrics(bajas, clients.length), [bajas, clients.length])
  const ranked = useMemo(() => rankByRisk(clients), [clients])
  const cohortRows = useMemo(() => cohorts(clients, cohortBy), [clients, cohortBy])

  const totalMonthly = clients.reduce((sum, c) => sum + (c.monthlyPrice || 0), 0)
  const withoutPrice = clients.filter(c => c.monthlyPrice == null).length
  const shownRisk = showAllRisk ? ranked : ranked.slice(0, MAX_RISK_ROWS)

  const stats = [
    { label: `Activos (${ACTIVE_WINDOW_DAYS} días)`, value: String(metrics.active) },
    { label: 'Nuevos este mes', value: String(metrics.newThisMonth) },
    { label: 'Sin actividad', value: String(metrics.likelyLost) },
    { label: 'Retención', value: metrics.retentionPct == null ? '—' : `${metrics.retentionPct}%` },
  ]

  return (
    <div className="space-y-6">
      <div className="card-featured p-6">
        <p className="text-sm text-muted">Ingresos estimados al mes</p>
        <p className="font-serif font-bold text-5xl leading-none mt-2">{eur(totalMonthly)}</p>
        <p className="text-sm text-muted mt-3">
          {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
          {metrics.revenue.avgPerActiveClient != null && ` · ${eur(metrics.revenue.avgPerActiveClient)}/mes de media por cliente activo`}
          {withoutPrice > 0 && ` · ${withoutPrice} sin precio asignado`}
        </p>
        {metrics.revenue.atRiskMonthly > 0 && (
          <p className="text-sm font-semibold text-warn mt-2">{eur(metrics.revenue.atRiskMonthly)}/mes en clientes con riesgo de abandono</p>
        )}
      </div>

      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 px-1">
          {stats.map(k => (
            <div key={k.label}>
              <p className="text-xl font-serif font-bold">{k.value}</p>
              <p className="text-xs text-muted mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3 px-1">
          «Activo» es quien ha hecho un check-in o se ha pesado en los últimos {ACTIVE_WINDOW_DAYS} días. «Sin actividad» y «Retención» se calculan sobre
          los clientes con más de {ACTIVE_WINDOW_DAYS} días de antigüedad: es una estimación por actividad. Las bajas reales son las de abajo.
        </p>
      </div>

      <section aria-labelledby="biz-bajas">
        <h2 id="biz-bajas" className="text-sm font-semibold mb-2">Bajas (últimos {CHURN_WINDOW_DAYS} días)</h2>
        {bajas.length === 0 ? (
          <div className="card p-5">
            <p className="text-sm text-muted">Todavía no has dado de baja a ningún cliente. Cuando alguien deje de ser tu cliente, dale de baja desde su Perfil (en vez de eliminarlo) y aquí verás cuántos se van, por qué y cuánto dejas de ingresar.</p>
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
              {[
                { label: 'Bajas', value: String(churn.bajas) },
                { label: 'Del total de clientes', value: churn.churnPct == null ? '—' : `${churn.churnPct}%` },
                { label: 'Cuotas que dejas de ingresar', value: `${eur(churn.lostMonthly)}/mes` },
                { label: 'Estuvieron de media', value: churn.avgTenureDays == null ? '—' : formatTenure(churn.avgTenureDays) },
              ].map(k => (
                <div key={k.label}>
                  <p className="text-xl font-serif font-bold">{k.value}</p>
                  <p className="text-xs text-muted mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
            {churn.byReason.length > 0 && (
              <ul className="space-y-1.5" aria-label="Motivos de baja">
                {churn.byReason.map(r => (
                  <li key={r.reason} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0 truncate">{r.label}</span>
                    <span className="w-28 h-1.5 rounded-full bg-bg-alt overflow-hidden flex-shrink-0" aria-hidden="true">
                      <span className="block h-full bg-accent" style={{ width: `${Math.round((r.count / churn.bajas) * 100)}%` }} />
                    </span>
                    <span className="tabular-nums text-xs text-muted w-6 text-right">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">«Del total de clientes» es el % de los que has tenido en este periodo (activos hoy + dados de baja) que se fueron. Los clientes dados de baja no cuentan en el resto de cifras.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="biz-risk">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 id="biz-risk" className="text-sm font-semibold">Riesgo de abandono</h2>
          <span className="text-xs text-muted">
            {metrics.highRisk} alto · {metrics.mediumRisk} medio · {clients.length - metrics.highRisk - metrics.mediumRisk} sin riesgo
          </span>
        </div>
        {clients.length === 0 ? (
          <div className="card p-5"><p className="text-sm text-muted">Todavía no tienes clientes.</p></div>
        ) : (
          <>
            <div className="card divide-y divide-border/60 overflow-hidden">
              {shownRisk.map(({ client: c, risk }) => (
                <button key={c.id} onClick={() => onOpenClient(c, risk.level === 'high' ? 'mensajes' : 'seguimiento')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-alt/60 transition-colors">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[risk.level]}`} aria-label={RISK_LABEL[risk.level]} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{c.name} {c.surname}</span>
                    <span className="block text-xs text-muted">{risk.reasons.join(' · ')}</span>
                  </span>
                  {c.monthlyPrice != null && <span className="text-xs text-muted flex-shrink-0">{eur(c.monthlyPrice)}</span>}
                  <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                </button>
              ))}
            </div>
            {ranked.length > MAX_RISK_ROWS && (
              <button onClick={() => setShowAllRisk(v => !v)} className="mt-2 text-xs font-semibold text-accent">
                {showAllRisk ? 'Ver menos' : `Ver los ${ranked.length - MAX_RISK_ROWS} restantes`}
              </button>
            )}
          </>
        )}
      </section>

      {clients.length > 0 && (
        <section aria-labelledby="biz-cohorts">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <h2 id="biz-cohorts" className="text-sm font-semibold">Cohortes</h2>
            <div role="tablist" aria-label="Agrupar por" className="flex bg-bg-alt rounded-lg p-0.5">
              {([['goal', 'Por objetivo'], ['joinMonth', 'Por mes de alta']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={cohortBy === id} onClick={() => setCohortBy(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${cohortBy === id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[34rem]">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="font-medium px-4 py-3">Grupo</th>
                  <th className="font-medium px-2 py-3 text-right">Clientes</th>
                  <th className="font-medium px-2 py-3 text-right">Peso (cambio medio)</th>
                  <th className="font-medium px-2 py-3 text-right">Adherencia</th>
                  <th className="font-medium px-2 py-3 text-right">Activos 7 d</th>
                  <th className="font-medium px-4 py-3 text-right">Objetivo logrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {cohortRows.map(r => (
                  <tr key={r.key}>
                    <td className="px-4 py-3 font-semibold">{r.label}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.clients}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{pct(r.weightChangePct, true)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.adherencePct}%</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.activeWeekPct}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.goalReachedPct == null ? '—' : `${r.goalReachedPct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2 px-1">
            El peso es el cambio desde el primer pesaje de cada cliente. «Objetivo logrado» cuenta solo a quien tiene un peso objetivo fijado.
          </p>
        </section>
      )}

      {withoutPrice > 0 && (
        <p className="text-xs text-muted">
          Los ingresos son una estimación a partir del precio mensual de cada cliente — no es facturación real.
          {' '}Asigna el precio que falta en el Perfil de cada cliente.
        </p>
      )}
    </div>
  )
}
