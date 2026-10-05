import { AlertKind, LOW_ADHERENCE_PCT, NO_WEIGH_IN_DAYS } from '../../lib/clientAlerts'
import { ALERT_KINDS, AutomationSettings, isAppointmentReminderEnabled, isKindEnabled } from '../../lib/alertDigest'
import { useAutomationSettings } from '../../hooks/useAutomationSettings'
import { toast } from '../shared/Toast'

const KIND_INFO: Record<AlertKind, { title: string; hint: string }> = {
  weight_stalled: { title: 'Peso estancado', hint: 'Un cliente que busca perder o ganar peso lleva 3 semanas sin moverse.' },
  high_hunger: { title: 'Hambre alta', hint: 'Hambre media de 4 o más sobre 5 durante la última semana.' },
  low_energy: { title: 'Energía baja', hint: 'Energía media inferior a 2,5 sobre 5 durante la última semana.' },
  low_adherence: { title: 'Adherencia baja', hint: `Menos del ${LOW_ADHERENCE_PCT} % de adherencia esta semana.` },
  no_weigh_in: { title: 'Sin registrar peso', hint: `Más de ${NO_WEIGH_IN_DAYS} días sin pesarse.` },
  goal_reached: { title: 'Objetivo alcanzado', hint: 'Un cliente llega a su peso objetivo (una buena noticia).' },
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${checked ? 'bg-accent' : 'bg-border'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

/**
 * Ajustes → Avisos: qué recibe el nutricionista en su resumen diario. Los avisos
 * llegan SOLO al nutricionista; nunca se escribe al cliente de forma automática.
 */
export function AvisosPanel({ nutricionistaId, demoMode }: { nutricionistaId: string; demoMode?: boolean }) {
  const { settings, loading, save } = useAutomationSettings(nutricionistaId, !!demoMode)

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  const update = async (next: AutomationSettings) => {
    const ok = await save(next)
    if (!ok) toast('No se pudo guardar el cambio', 'warn')
    else if (demoMode) toast('Modo demo: los cambios no se guardan de verdad', 'ok')
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-2">
        <p className="font-semibold text-sm">Resumen diario</p>
        <p className="text-sm text-muted leading-relaxed">
          Cada mañana recibirás una única notificación con lo que ha aparecido de nuevo, en los dispositivos donde tengas activadas las
          notificaciones (la campana de la cabecera). Cada aviso se envía una sola vez, no se repite cada día. <strong className="text-ink">Nunca se
          envía nada a tus clientes</strong>: son solo para ti.
        </p>
      </div>

      <div className="card px-5 divide-y divide-border/60">
        {ALERT_KINDS.map(kind => (
          <div key={kind} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{KIND_INFO[kind].title}</p>
              <p className="text-xs text-muted">{KIND_INFO[kind].hint}</p>
            </div>
            <Switch label={KIND_INFO[kind].title} checked={isKindEnabled(settings, kind)}
              onChange={v => update({ ...settings, kinds: { ...settings.kinds, [kind]: v } })} />
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Citas de mañana</p>
            <p className="text-xs text-muted">Un recordatorio con las citas del día siguiente.</p>
          </div>
          <Switch label="Citas de mañana" checked={isAppointmentReminderEnabled(settings)}
            onChange={v => update({ ...settings, appointments_tomorrow: v })} />
        </div>
      </div>

      <p className="text-xs text-muted px-1">
        Los clientes que llevan varios días sin hacer check-in ya tienen su propio aviso aparte, que no se desactiva desde aquí.
      </p>
    </div>
  )
}
