import { useState, useMemo } from 'react'
import { ClientData } from '../../types'
import { useMessageTemplates, resolveMessage } from '../../lib/messageTemplates'
import { buildWAUrl } from '../../lib/whatsapp'
import { sendPush } from '../../lib/usePushNotifications'
import { toast } from '../shared/Toast'
import { ToolHeader } from './ToolHeader'
import { MessageCircle, Check } from 'lucide-react'

type Step = 1 | 2 | 3
const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Destinatarios' },
  { id: 2, label: 'Mensaje' },
  { id: 3, label: 'Revisar y enviar' },
]

/** Difusión en tres pasos: a quién → qué se le dice → revisar y enviar. */
export function DifusionTab({ clients, nutricionistaId, demoMode }: {
  clients: ClientData[]
  nutricionistaId: string
  demoMode?: boolean
}) {
  const { templates } = useMessageTemplates(nutricionistaId, demoMode)
  const allTags = useMemo(() => Array.from(new Set(clients.flatMap(c => c.tags))).sort(), [clients])
  const [step, setStep] = useState<Step>(1)
  const [tag, setTag] = useState<string>(allTags[0] || '')
  const [text, setText] = useState('')
  const [pushTitle, setPushTitle] = useState('')
  const [sendingPush, setSendingPush] = useState(false)

  const matching = tag ? clients.filter(c => c.tags.includes(tag)) : clients
  const canAdvance = step === 1 ? matching.length > 0 : step === 2 ? text.trim().length > 0 : false

  const sendPushToAll = async () => {
    if (!pushTitle.trim() || !text.trim()) { toast('Pon un título y un mensaje', 'warn'); return }
    if (matching.length === 0) { toast('No hay clientes en este grupo', 'warn'); return }
    if (demoMode) { toast(`Modo demo: se enviaría a ${matching.length} cliente(s) (no se envía de verdad)`, 'ok'); return }
    setSendingPush(true)
    await Promise.allSettled(matching.map(c => sendPush({ clientId: c.id }, pushTitle.trim(), resolveMessage(text, c.name))))
    setSendingPush(false)
    toast(`Notificación enviada a ${matching.length} cliente(s) ✓`, 'ok')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ToolHeader title="Difusión">
        Manda un mensaje o una notificación a un grupo de clientes según su etiqueta, en vez de uno a uno.
      </ToolHeader>

      <ol className="flex items-center gap-2" aria-label="Pasos">
        {STEPS.map(s => {
          const done = s.id < step
          const current = s.id === step
          return (
            <li key={s.id} className="flex items-center gap-2 min-w-0">
              <button onClick={() => done && setStep(s.id)} disabled={!done} aria-current={current ? 'step' : undefined}
                className={`flex items-center gap-1.5 text-sm font-semibold min-w-0 ${current ? 'text-ink' : done ? 'text-accent' : 'text-muted'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  current ? 'bg-ink text-white' : done ? 'bg-accent/15 text-accent' : 'bg-bg-alt text-muted'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : s.id}
                </span>
                <span className={current ? '' : 'hidden sm:inline'}>{s.label}</span>
              </button>
              {s.id < 3 && <span className="w-4 sm:w-6 h-px bg-border flex-shrink-0" />}
            </li>
          )
        })}
      </ol>

      {step === 1 && (
        <div className="card p-5 space-y-4">
          <p className="font-semibold text-sm">¿A quién se lo mandas?</p>
          {allTags.length === 0 ? (
            <p className="text-sm text-muted">Todavía no has puesto etiquetas a ningún cliente — añádelas desde el perfil de cada cliente (ej. "Pérdida de grasa - Nivel 1").</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setTag('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tag === '' ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>
                Todos ({clients.length})
              </button>
              {allTags.map(t => {
                const count = clients.filter(c => c.tags.includes(t)).length
                return (
                  <button key={t} onClick={() => setTag(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tag === t ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>
                    {t} ({count})
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-sm text-muted">
            <strong className="text-ink">{matching.length}</strong> cliente{matching.length === 1 ? '' : 's'} en este grupo
            {matching.length > 0 && `: ${matching.map(c => c.name).join(', ')}`}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5 space-y-4">
          <p className="font-semibold text-sm">¿Qué les quieres decir?</p>
          {templates.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5">Partir de una plantilla</p>
              <div className="flex flex-wrap gap-1.5">
                {templates.map(t => (
                  <button key={t.id} onClick={() => setText(t.texto)}
                    className="px-2.5 py-1 bg-bg-alt rounded-lg text-xs font-medium hover:bg-accent/10 hover:text-accent transition-colors">
                    {t.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label htmlFor="difusion-text" className="block text-xs text-muted mb-1.5">Mensaje</label>
            <textarea id="difusion-text" value={text} onChange={e => setText(e.target.value)} rows={4}
              placeholder="Usa {{cliente}} para que se sustituya por el nombre de cada uno..."
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="card p-5 space-y-3">
            <p className="font-semibold text-sm">Revisa antes de enviar</p>
            <p className="text-sm text-muted">
              Para <strong className="text-ink">{matching.length}</strong> cliente{matching.length === 1 ? '' : 's'}
              {tag ? ` · ${tag}` : ' · todos'}
            </p>
            <div className="bg-bg-alt rounded-xl px-4 py-3">
              <p className="text-sm italic">"{resolveMessage(text, matching[0]?.name ?? 'Nombre')}"</p>
              {text.includes('{{cliente}}') && matching[0] && (
                <p className="text-xs text-muted mt-1.5">Ejemplo con {matching[0].name}; cada cliente recibe el suyo con su nombre.</p>
              )}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <p className="text-sm font-semibold">Notificación push</p>
            <p className="text-xs text-muted">Llega a la app de cada cliente que tenga las notificaciones activadas. Es un envío real a todo el grupo.</p>
            <input value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="Título de la notificación" aria-label="Título de la notificación"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
            <button onClick={sendPushToAll} disabled={sendingPush}
              className="w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
              {sendingPush ? 'Enviando...' : `Enviar push a ${matching.length} cliente${matching.length === 1 ? '' : 's'}`}
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <p className="text-sm font-semibold">WhatsApp</p>
            <p className="text-xs text-muted">Uno a uno: WhatsApp no permite el envío automático masivo.</p>
            <div className="space-y-1.5">
              {matching.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-bg-alt rounded-xl px-3 py-2">
                  <span className="text-sm font-medium min-w-0 truncate">{c.name} {c.surname}</span>
                  <button onClick={() => window.open(buildWAUrl(c.phone, resolveMessage(text, c.name)), '_blank')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#25D366] text-white rounded-lg text-xs font-bold flex-shrink-0">
                    <MessageCircle className="w-3.5 h-3.5" /> Enviar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        {step > 1
          ? <button onClick={() => setStep((step - 1) as Step)} className="px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted hover:text-ink">Atrás</button>
          : <span />}
        {step < 3 && (
          <button onClick={() => setStep((step + 1) as Step)} disabled={!canAdvance}
            className="px-5 py-2.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40">
            Siguiente
          </button>
        )}
      </div>
    </div>
  )
}
