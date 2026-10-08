import { ClientWithStats } from '../../hooks/useNutricionistaClients'
import { goalLabel } from '../../lib/constants'
import { weightDeltaTone, formatKg, formatWeightDelta, daysSinceActivity, activityLabel } from '../../lib/clientListSummary'
import { HEALTH_BADGE, TONE_CLASS } from './healthStyles'
import { Flame, Copy, Crown, ChevronRight } from 'lucide-react'

/**
 * Una fila = una persona + su estado + una acción. Sustituye a la antigua
 * tarjeta en cuadrícula: el estado (semáforo) es lo primero que se lee, y el
 * peso, la adherencia y la racha se comparan de un vistazo entre filas.
 */
export function ClientListRow({ client: c, isTopStreak, onOpen, onCopyLink }: {
  client: ClientWithStats
  isTopStreak: boolean
  onOpen: () => void
  onCopyLink: () => void
}) {
  const badge = HEALTH_BADGE[c.healthStatus || 'active']
  const BadgeIcon = badge.icon
  const adherence = c.adherence7d || 0
  const tone = weightDeltaTone(c.goal, c.weightDeltaKg ?? null)
  const idleDays = daysSinceActivity(c.lastActivity)

  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className={`group flex flex-col gap-3 md:flex-row md:items-center md:gap-5 px-4 py-3.5 border-l-4 ${badge.stripe} cursor-pointer hover:bg-bg-alt/60 focus-visible:bg-bg-alt/60 outline-none transition-colors`}>

      <div className="flex items-start justify-between gap-3 md:flex-1 md:min-w-0">
        <div className="min-w-0">
          <p className="font-serif font-bold text-lg leading-tight flex items-center gap-1.5">
            <span className="truncate">{c.name} {c.surname}</span>
            {isTopStreak && <Crown className="w-4 h-4 text-accent flex-shrink-0" aria-label="Mejor racha" />}
          </p>
          {c.goal && <p className="text-xs text-muted mt-0.5 truncate">{goalLabel(c.goal)}</p>}
          <p className={`text-xs mt-0.5 ${idleDays == null || idleDays >= 5 ? 'text-warn font-semibold' : 'text-muted'}`}>
            Última actividad: {activityLabel(idleDays).toLowerCase()}
          </p>
          <span className={`md:hidden inline-flex items-center gap-1 px-2.5 py-1 mt-2 rounded-full text-xs font-semibold max-w-full ${badge.pill}`}>
            <BadgeIcon className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{c.healthLabel || 'Activo'}</span>
          </span>
        </div>
        <button onClick={e => { e.stopPropagation(); onCopyLink() }}
          className="md:hidden p-2 -mt-1 rounded-lg text-muted hover:text-ink flex-shrink-0" title="Copiar enlace del cliente" aria-label="Copiar enlace del cliente">
          <Copy className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-5 text-sm md:gap-6">
        <div className="md:w-24">
          {c.weightKg != null ? (
            <>
              <p className="font-semibold leading-tight">{formatKg(c.weightKg)} <span className="text-xs font-normal text-muted">kg</span></p>
              <p className={`text-xs leading-tight ${TONE_CLASS[tone]}`}>
                {formatWeightDelta(c.weightDeltaKg)}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">Sin peso</p>
          )}
        </div>
        <div className="flex-1 md:w-36 md:flex-none">
          <p className="font-semibold leading-tight">{adherence}% <span className="text-xs font-normal text-muted">adherencia</span></p>
          <div className="h-1.5 bg-bg-alt rounded-full overflow-hidden mt-1">
            <div className="h-full bg-accent rounded-full" style={{ width: `${adherence}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted md:w-14">
          <Flame className={`w-4 h-4 ${(c.streak || 0) > 0 ? 'text-accent' : ''}`} />
          <span className="font-semibold text-ink">{c.streak || 0}</span><span className="text-xs">d</span>
        </div>
      </div>

      <span className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold w-40 justify-center flex-shrink-0 ${badge.pill}`}>
        <BadgeIcon className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{c.healthLabel || 'Activo'}</span>
      </span>

      <div className="hidden md:flex items-center gap-1 flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); onCopyLink() }}
          className="p-2 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors" title="Copiar enlace del cliente" aria-label="Copiar enlace del cliente">
          <Copy className="w-4 h-4" />
        </button>
        <span className="flex items-center gap-0.5 text-xs font-bold text-accent pl-1">Ver <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </div>
  )
}
