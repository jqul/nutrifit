export function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
    </div>
  )
}

/** Barra de progreso "objetivo vs. lo sumado en las comidas" para un macro —
 * se llena hasta el 100% del objetivo; si se pasa, la barra se corta en
 * 100% pero cambia a rojo y el número muestra el exceso real. Sin objetivo
 * fijado (0 o vacío) no hay nada que comparar, así que no se pinta barra. */
export function MacroProgressBar({ label, actual, target, unit }: { label: string; actual: number; target: number; unit: string }) {
  if (!target) return null
  const pct = (actual / target) * 100
  const over = pct > 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-muted">{label}</span>
        <span className={over ? 'text-warn font-semibold' : 'text-muted'}>
          {Math.round(actual * 10) / 10}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-1.5 bg-bg-alt rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${over ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  )
}

export function CalcNumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}

export function MacroPreview({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg rounded-lg py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xs font-bold mt-0.5">{value}</p>
    </div>
  )
}

/** Vista previa de la lista de la compra que le va a generar el plan al
 * cliente (misma lógica que DietaClienteTab), para que el nutricionista
 * pueda verla/revisarla sin tener que mirar el panel del cliente. */
export function MicroInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-xs text-muted whitespace-nowrap">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-14 px-1.5 py-1 bg-bg border border-border rounded-md text-xs outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}
