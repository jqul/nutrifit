import { ClientData } from '../../../types'
import { goalLabel } from '../../../lib/constants'
import { buildWAUrl } from '../../../lib/whatsapp'
import { calcBmi, bmiCategory } from '../../../lib/bmi'
import { AlertTriangle, MessageCircle } from 'lucide-react'

const BMI_CATEGORY_CLASS: Record<string, string> = {
  'bajo peso': 'text-notice', normal: 'text-ok', sobrepeso: 'text-notice', obesidad: 'text-warn',
}

/** Barra lateral fija de la ficha de cliente (solo en escritorio, ver
 * ClientPanel) — un resumen biométrico rápido para no tener que entrar en
 * Perfil ni desplazarse por toda la pestaña activa solo para ver el peso,
 * el IMC o si hay alergias antes de escribirle. */
export function ClientSidebar({ client, currentWeight }: { client: ClientData; currentWeight: number | null }) {
  const remainingKg = currentWeight != null && client.goalWeightKg != null
    ? Math.abs(currentWeight - client.goalWeightKg) : null
  const goalReached = remainingKg != null && remainingKg < 0.5
  const bmi = currentWeight != null && client.heightCm ? calcBmi(currentWeight, client.heightCm) : null
  const category = bmi != null ? bmiCategory(bmi) : null

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center text-2xl font-serif font-bold mx-auto">
          {client.name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-serif font-bold text-lg leading-tight">{client.name} {client.surname}</p>
          {client.goal && <p className="text-xs text-muted mt-0.5">{goalLabel(client.goal)}</p>}
        </div>
        {client.phone && (
          <a href={buildWAUrl(client.phone, `Hola ${client.name}, `)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-ok/10 text-ok rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
            <MessageCircle className="w-3.5 h-3.5" /> Escribir por WhatsApp
          </a>
        )}
      </div>

      {(currentWeight != null || client.heightCm != null) && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Datos biométricos</p>
          <div className="grid grid-cols-2 gap-2">
            {currentWeight != null && <MiniStat label="Peso actual" value={`${currentWeight} kg`} />}
            {remainingKg != null && (
              <MiniStat label={goalReached ? 'Meta alcanzada 🎉' : 'A la meta'} value={goalReached ? '' : `${remainingKg.toFixed(1)} kg`} valueClassName={goalReached ? 'text-ok' : ''} />
            )}
            {client.heightCm != null && <MiniStat label="Altura" value={`${client.heightCm} cm`} />}
            {bmi != null && category && (
              <MiniStat label="IMC" value={bmi.toFixed(1)} sublabel={category} valueClassName={BMI_CATEGORY_CLASS[category]} />
            )}
          </div>
        </div>
      )}

      {client.allergies && (
        <div className="bg-warn/10 border border-warn/20 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-warn mb-0.5">Alergias / intolerancias</p>
            <p className="text-sm text-ink">{client.allergies}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, sublabel, valueClassName = '' }: { label: string; value: string; sublabel?: string; valueClassName?: string }) {
  return (
    <div className="bg-bg-alt rounded-xl p-2.5 text-center">
      <p className={`text-sm font-bold ${valueClassName}`}>{value}</p>
      <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{sublabel || label}</p>
    </div>
  )
}
