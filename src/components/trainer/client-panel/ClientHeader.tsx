import { ClientWithStats } from '../../../hooks/useNutricionistaClients'
import { goalLabel } from '../../../lib/constants'
import { buildWAUrl } from '../../../lib/whatsapp'
import { calcBmi, bmiCategory } from '../../../lib/bmi'
import { weightDeltaTone, formatKg, formatWeightDelta } from '../../../lib/clientListSummary'
import { HEALTH_BADGE, TONE_CLASS } from '../healthStyles'
import { AlertTriangle, MessageCircle, Flame } from 'lucide-react'

const BMI_CATEGORY_CLASS: Record<string, string> = {
  'bajo peso': 'text-notice', normal: 'text-ok', sobrepeso: 'text-notice', obesidad: 'text-warn',
}

/**
 * Cabecera de la ficha de cliente (UX-11): se ve igual en TODAS las pestañas,
 * así el nutricionista tiene siempre delante quién es, cómo está (semáforo) y
 * sus tres cifras clave — peso, adherencia y racha — sin entrar en Perfil ni
 * buscar en una barra lateral. Sustituye a la antigua barra lateral
 * (ClientSidebar). Las alergias quedan siempre visibles bajo la cabecera.
 *
 * Adherencia y racha vienen del listado de clientes (ClientWithStats); si la
 * ficha se abre sin pasar por él se muestra "—" en vez de inventar un dato.
 */
export function ClientHeader({ client, currentWeight }: { client: ClientWithStats; currentWeight: number | null }) {
  const badge = HEALTH_BADGE[client.healthStatus || 'active']
  const BadgeIcon = badge.icon
  const weight = currentWeight ?? client.weightKg ?? null
  const tone = weightDeltaTone(client.goal, client.weightDeltaKg ?? null)
  const remainingKg = weight != null && client.goalWeightKg != null ? Math.abs(weight - client.goalWeightKg) : null
  const goalReached = remainingKg != null && remainingKg < 0.5
  const bmi = weight != null && client.heightCm ? calcBmi(weight, client.heightCm) : null
  const category = bmi != null ? bmiCategory(bmi) : null
  const adherence = client.adherence7d

  const details: React.ReactNode[] = []
  if (client.heightCm != null) details.push(<span key="h">{client.heightCm} cm</span>)
  if (bmi != null && category) details.push(<span key="b">IMC <span className={`font-semibold ${BMI_CATEGORY_CLASS[category]}`}>{bmi.toFixed(1).replace('.', ',')}</span> · {category}</span>)
  if (remainingKg != null) details.push(<span key="m" className={goalReached ? 'text-ok font-semibold' : ''}>{goalReached ? 'Meta alcanzada 🎉' : `a ${formatKg(remainingKg)} kg de la meta`}</span>)

  return (
    <section className="space-y-3 mb-6" aria-label="Resumen del cliente">
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center text-2xl font-serif font-bold flex-shrink-0">
            {client.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-serif font-bold text-2xl leading-tight">{client.name} {client.surname}</h1>
                {client.goal && <p className="text-sm text-muted mt-0.5">{goalLabel(client.goal)}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${badge.pill}`}>
                  <BadgeIcon className="w-3.5 h-3.5 flex-shrink-0" /> {client.healthLabel || 'Activo'}
                </span>
                {client.phone && (
                  <a href={buildWAUrl(client.phone, `Hola ${client.name}, `)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ok/10 text-ok rounded-full text-xs font-bold hover:opacity-90 transition-opacity">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/60">
          <div>
            <p className="text-xs text-muted">Peso</p>
            {weight != null ? (
              <>
                <p className="font-serif font-bold text-2xl leading-tight">{formatKg(weight)} <span className="text-sm font-sans font-normal text-muted">kg</span></p>
                <p className={`text-xs ${TONE_CLASS[tone]}`}>{formatWeightDelta(client.weightDeltaKg)} <span className="text-muted">· 4 sem.</span></p>
              </>
            ) : (
              <p className="font-serif font-bold text-2xl leading-tight text-muted">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted">Adherencia 7 días</p>
            {adherence != null ? (
              <>
                <p className="font-serif font-bold text-2xl leading-tight">{adherence}<span className="text-sm font-sans font-normal text-muted">%</span></p>
                <div className="h-1.5 bg-bg-alt rounded-full overflow-hidden mt-1.5 max-w-24">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${adherence}%` }} />
                </div>
              </>
            ) : (
              <p className="font-serif font-bold text-2xl leading-tight text-muted">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted">Racha</p>
            {client.streak != null ? (
              <p className="font-serif font-bold text-2xl leading-tight flex items-center gap-1">
                <Flame className={`w-5 h-5 ${client.streak > 0 ? 'text-accent' : 'text-muted'}`} />
                {client.streak}<span className="text-sm font-sans font-normal text-muted">días</span>
              </p>
            ) : (
              <p className="font-serif font-bold text-2xl leading-tight text-muted">—</p>
            )}
          </div>
        </div>

        {details.length > 0 && (
          <p className="text-xs text-muted mt-4 flex flex-wrap gap-x-2 gap-y-1">
            {details.map((d, i) => <span key={i} className="flex gap-2">{i > 0 && <span aria-hidden>·</span>}{d}</span>)}
          </p>
        )}
      </div>

      {client.allergies && (
        <div className="bg-warn/10 border border-warn/20 rounded-2xl px-4 py-3 flex items-start gap-2" role="note">
          <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink"><span className="font-bold text-warn">Alergias / intolerancias: </span>{client.allergies}</p>
        </div>
      )}
    </section>
  )
}
