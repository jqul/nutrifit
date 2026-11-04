import { MetricPoint, sparklinePath } from '../../lib/bodyMetrics'

/** La mini gráfica de una métrica (de la primera a la última medida). No pinta nada con menos de dos valores. */
export function MetricSparkline({ points, label }: { points: MetricPoint[]; label: string }) {
  const d = sparklinePath(points, 72, 24)
  if (!d) return <span className="w-[72px] flex-shrink-0" aria-hidden />
  return (
    <svg width="72" height="24" viewBox="0 0 72 24" className="flex-shrink-0 text-accent" role="img" aria-label={`Evolución de ${label}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
