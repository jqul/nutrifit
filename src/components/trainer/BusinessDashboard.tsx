import { Euro, Users, UserCheck, TrendingUp, Flame } from 'lucide-react'
import { ClientWithStats } from '../../hooks/useNutricionistaClients'

function daysAgo(dateStr?: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((Date.now() - d.getTime()) / 86400000)
}

export function BusinessDashboard({ clients }: { clients: ClientWithStats[] }) {
  const clientesTotales = clients.length
  const ingresosMensuales = clients.reduce((sum, c) => sum + (c.monthlyPrice || 0), 0)
  const clientesSinPrecio = clients.filter(c => c.monthlyPrice == null).length
  const clientesActivos = clients.filter(c => { const d = daysAgo(c.lastCheckin); return d !== null && d <= 7 }).length
  const adherenciaMedia = clientesTotales > 0
    ? Math.round(clients.reduce((sum, c) => sum + (c.adherence7d || 0), 0) / clientesTotales)
    : 0
  const rachaMedia = clientesTotales > 0
    ? Math.round(clients.reduce((sum, c) => sum + (c.streak || 0), 0) / clientesTotales * 10) / 10
    : 0

  const KPIS = [
    { label: 'Ingresos estimados/mes', value: `${ingresosMensuales}€`, icon: Euro, color: 'border-t-accent' },
    { label: 'Clientes totales', value: String(clientesTotales), icon: Users, color: 'border-t-ink' },
    { label: 'Activos (7 días)', value: String(clientesActivos), icon: UserCheck, color: 'border-t-ok' },
    { label: 'Adherencia media', value: `${adherenciaMedia}%`, icon: TrendingUp, color: 'border-t-accent2' },
    { label: 'Racha media', value: `${rachaMedia}d`, icon: Flame, color: 'border-t-warn' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPIS.map(k => (
          <div key={k.label} className={`bg-card border border-border border-t-4 ${k.color} rounded-2xl p-4`}>
            <k.icon className="w-4 h-4 text-muted mb-2" />
            <p className="text-xl font-serif font-bold">{k.value}</p>
            <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {clientesSinPrecio > 0 && (
        <p className="text-xs text-muted">
          Los ingresos son una estimación a partir del precio mensual que le pongas a cada cliente — no es facturación real.
          {' '}{clientesSinPrecio} {clientesSinPrecio === 1 ? 'cliente no tiene' : 'clientes no tienen'} precio asignado (edítalo en su Perfil).
        </p>
      )}

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3">Actividad por cliente</p>
        {clients.length === 0 ? (
          <p className="text-sm text-muted">Todavía no tienes clientes.</p>
        ) : (
          <div className="divide-y divide-border">
            {clients.map(c => {
              const d = daysAgo(c.lastCheckin)
              return (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <span className="truncate">{c.name} {c.surname}</span>
                  </div>
                  <span className="text-xs text-muted flex-shrink-0">
                    {d === null ? 'Sin check-ins' : d === 0 ? 'Hoy' : `Hace ${d}d`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
