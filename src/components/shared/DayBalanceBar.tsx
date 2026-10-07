/** Barra del balance de un día: lo comido del plan (verde) y los extras fuera del plan (ámbar) frente al objetivo (marca). */
export function DayBalanceBar({ planKcal, extrasKcal, targetKcal }: { planKcal: number; extrasKcal: number; targetKcal: number | null }) {
  const total = planKcal + extrasKcal
  const scale = Math.max(targetKcal ?? 0, total, 1)
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`
  const over = targetKcal != null && total > targetKcal
  return (
    <div className="relative h-2.5 rounded-full bg-bg-alt overflow-hidden" role="img"
      aria-label={`${planKcal} kcal del plan y ${extrasKcal} kcal de extras${targetKcal ? ` de ${targetKcal} kcal de objetivo` : ''}`}>
      <div className="absolute inset-y-0 left-0 w-full flex">
        <div className="h-full bg-ok" style={{ width: pct(planKcal), minWidth: planKcal > 0 ? 2 : 0 }} />
        <div className={`h-full ${over ? 'bg-warn' : 'bg-notice'}`} style={{ width: pct(extrasKcal), minWidth: extrasKcal > 0 ? 2 : 0 }} />
      </div>
      {/* El final de la barra es el objetivo; solo se marca aparte cuando se ha pasado */}
      {targetKcal != null && targetKcal < scale && (
        <div className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: pct(targetKcal) }} />
      )}
    </div>
  )
}
