import { useState, useMemo } from 'react'
import { ClientData } from '../../types'
import { useMessageTemplates, resolveMessage } from '../../lib/messageTemplates'
import { buildWAUrl } from '../../lib/whatsapp'
import { sendPush } from '../../lib/usePushNotifications'
import { toast } from '../shared/Toast'
import { Megaphone, MessageCircle, Bell, Tag } from 'lucide-react'

export function DifusionTab({ clients, nutricionistaId, demoMode }: {
  clients: ClientData[]
  nutricionistaId: string
  demoMode?: boolean
}) {
  const { templates } = useMessageTemplates(nutricionistaId, demoMode)
  const allTags = useMemo(() => Array.from(new Set(clients.flatMap(c => c.tags))).sort(), [clients])
  const [tag, setTag] = useState<string>(allTags[0] || '')
  const [text, setText] = useState('')
  const [pushTitle, setPushTitle] = useState('')
  const [sendingPush, setSendingPush] = useState(false)

  const matching = tag ? clients.filter(c => c.tags.includes(tag)) : clients

  const applyTemplate = (texto: string) => setText(texto)

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
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-serif font-bold">Difusión</h1>
        </div>
        <p className="text-sm text-muted">
          Manda un mensaje o una notificación a un grupo de clientes según su etiqueta, en vez de uno a uno.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Grupo</label>
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
        </div>

        <p className="text-xs text-muted">
          <strong className="text-ink">{matching.length}</strong> cliente{matching.length === 1 ? '' : 's'} en este grupo
          {matching.length > 0 && `: ${matching.map(c => c.name).join(', ')}`}
        </p>

        {templates.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Partir de una plantilla</label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t.texto)}
                  className="px-2.5 py-1 bg-bg-alt rounded-lg text-xs font-medium hover:bg-accent/10 hover:text-accent transition-colors">
                  {t.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Mensaje</label>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
            placeholder="Usa {{cliente}} para que se sustituya por el nombre de cada uno..."
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Bell className="w-4 h-4" /> Notificación push (envío de verdad a todo el grupo)</p>
        <input value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="Título de la notificación"
          className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        <button onClick={sendPushToAll} disabled={sendingPush}
          className="w-full py-3 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
          {sendingPush ? 'Enviando...' : `Enviar push a ${matching.length} cliente${matching.length === 1 ? '' : 's'}`}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> WhatsApp (uno a uno — WhatsApp no permite envío automático masivo)</p>
        {matching.length === 0 ? (
          <p className="text-sm text-muted">No hay clientes en este grupo.</p>
        ) : (
          <div className="space-y-1.5">
            {matching.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 bg-bg-alt rounded-xl px-3 py-2">
                <span className="text-sm font-medium">{c.name} {c.surname}</span>
                <button
                  onClick={() => window.open(buildWAUrl(c.phone, resolveMessage(text, c.name)), '_blank')}
                  disabled={!text.trim()}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#25D366] text-white rounded-lg text-[10px] font-bold disabled:opacity-40">
                  📱 Enviar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
