import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ClientWithStats } from '../../hooks/useNutricionistaClients'
import { ClientPanelTab } from '../../lib/controlCenter'
import { ACTIVE_WINDOW_DAYS, CohortKey, RiskLevel, cohorts, rankByRisk, retentionMetrics } from '../../lib/retention'

const RISK_DOT: Record<RiskLevel, string> = { high: 'bg-warn', medium: 'bg-notice', low: 'bg-ok' }
const RISK_LABEL: Record<RiskLevel, string> = { high: 'Riesgo alto', medium: 'Riesgo medio', low: 'Sin riesgo' }
const MAX_RISK_ROWS = 8

const eur = (n: number) => `${n.toLocaleString('es-ES')} €`
const pct = (n: number | null, signed = false) => n == null ? '—' : `${signed && n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toString().replace('.', ',')}%`

/**
 * Negocio: cuánto entra al mes, cómo está la retención y a quién hay que cuidar
 * para que no se vaya. La retención se mide por actividad (check-ins y pesajes),
 * no por bajas, porque NutriFit no guarda cuándo un cliente se va.
 */
export function BusinessDashboard({ clients, onOpenClient }: {
  clients: ClientWithStats[]
  onOpenClient: (client: ClientWithStats, tab?: ClientPanelTab) => void
}) {
  const [cohortBy, setCohortBy] = useState<CohortKey>('goal')
  const [showAllRisk, setShowAllRisk] = useState(false)

  const metrics = useMemo(() => retentionMetrics(clients), [clients])
  const ranked = useMemo(() => rankByRisk(clients), [clients])
  const cohortRows = useMemo(() => cohorts(clients, cohortBy), [clients, cohortBy])

  const totalMonthly = clients.reduce((sum, c) => sum + (c.monthlyPrice || 0), 0)
  const withoutPrice = clients.filter(c => c.monthlyPrice == null).length
  const shownRisk = showAllRisk ? ranked : ranked.slice(0, MAX_RISK_ROWS)

  const stats = [
    { label: `Activos (${ACTIVE_WINDOW_DAYS} días)`, value: String(metrics.active) },
    { label: 'Nuevos este mes', value: String(metrics.newThisMonth) },
    { label: 'Posibles bajas', value: String(metrics.likelyLost) },
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
          «Activo» es quien ha hecho un check-in o se ha pesado en los últimos {ACTIVE_WINDOW_DAYS} días. «Posibles bajas» y «Retención» se calculan sobre
          los clientes con más de {ACTIVE_WINDOW_DAYS} días de antigüedad: no son bajas confirmadas, NutriFit no registra cuándo alguien se va.
        </p>
      </div>

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
