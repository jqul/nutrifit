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

  // Un solo dato protagonista (lo que facturas al mes); el resto, en segundo plano.
  const SECONDARY = [
    { label: 'Clientes', value: String(clientesTotales) },
    { label: 'Activos (7 días)', value: String(clientesActivos) },
    { label: 'Adherencia media', value: `${adherenciaMedia}%` },
    { label: 'Racha media', value: `${String(rachaMedia).replace('.', ',')}d` },
  ]

  return (
    <div className="space-y-6">
      <div className="card-featured p-6">
        <p className="text-sm text-muted">Ingresos estimados al mes</p>
        <p className="font-serif font-bold text-5xl leading-none mt-2">{ingresosMensuales.toLocaleString('es-ES')} €</p>
        <p className="text-sm text-muted mt-3">
          {clientesTotales} {clientesTotales === 1 ? 'cliente' : 'clientes'}
          {clientesSinPrecio > 0 && ` · ${clientesSinPrecio} sin precio asignado`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 px-1">
        {SECONDARY.map(k => (
          <div key={k.label}>
            <p className="text-xl font-serif font-bold">{k.value}</p>
            <p className="text-xs text-muted mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {clientesSinPrecio > 0 && (
        <p className="text-xs text-muted">
          Los ingresos son una estimación a partir del precio mensual de cada cliente — no es facturación real.
          {' '}Asigna el precio que falta en el Perfil de cada cliente.
        </p>
      )}

      <div className="card p-5">
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
