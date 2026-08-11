import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Scale } from 'lucide-react'
import { WeightEntry } from '../../types'

export function WeightChart({ entries, goalKg }: { entries: WeightEntry[]; goalKg?: number | null }) {
  if (entries.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted">
        <Scale className="w-8 h-8 opacity-30 mb-2" />
        <p className="text-sm">Sin historial de peso suficiente todavía</p>
      </div>
    )
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const data = sorted.map(w => ({ fecha: new Date(w.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), kg: w.weightKg }))
  const values = data.map(d => d.kg).concat(goalKg ? [goalKg] : [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const cambio = data[data.length - 1].kg - data[0].kg
  const faltan = goalKg != null ? data[data.length - 1].kg - goalKg : null

  const cards = [
    { label: 'Peso inicial', value: `${data[0].kg} kg`, color: 'text-muted' },
    { label: 'Peso actual', value: `${data[data.length - 1].kg} kg`, color: 'text-ink' },
    goalKg != null
      ? { label: 'Para tu meta', value: `${faltan! >= 0 ? '−' : '+'}${Math.abs(faltan!).toFixed(1)} kg`, color: Math.abs(faltan!) < 0.1 ? 'text-ok' : 'text-accent' }
      : { label: 'Cambio total', value: `${cambio >= 0 ? '+' : ''}${cambio.toFixed(1)} kg`, color: cambio <= 0 ? 'text-ok' : 'text-warn' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {cards.map((k, i) => (
          <div key={i} className="bg-bg-alt rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gPeso" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3f7d4f" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3f7d4f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8a8278' }} />
            <YAxis domain={[min * 0.98, max * 1.02]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8a8278' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            {goalKg != null && (
              <ReferenceLine y={goalKg} stroke="#c17f3e" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: `Meta: ${goalKg}kg`, position: 'insideTopRight', fontSize: 10, fill: '#c17f3e' }} />
            )}
            <Area type="monotone" dataKey="kg" name="Peso" stroke="#3f7d4f" strokeWidth={2.5} fill="url(#gPeso)" dot={{ fill: '#3f7d4f', r: 3 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
