import { useState } from 'react'
import { Pencil, Check, Plus, Trash2, MessageCircle } from 'lucide-react'
import { ClientData } from '../../../types'
import { useMessageTemplates, resolveMessage } from '../../../lib/messageTemplates'
import { buildWAUrl } from '../../../lib/whatsapp'
import { toast } from '../../shared/Toast'

export function MensajesTab({ client, nutricionistaId, onUpdate, demoMode }: {
  client: ClientData
  nutricionistaId: string
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
  demoMode?: boolean
}) {
  const { templates, loading, saveTemplate, addTemplate, deleteTemplate } = useMessageTemplates(nutricionistaId, demoMode)
  const [editingDefault, setEditingDefault] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [newName, setNewName] = useState('')
  const [newText, setNewText] = useState('')

  const overrides = client.customMessages || {}

  const setOverride = async (id: string, texto: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    await onUpdate({ customMessages: { ...overrides, [id]: texto } })
  }

  const removeOverride = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    const next = { ...overrides }
    delete next[id]
    await onUpdate({ customMessages: next })
  }

  const sendWhatsApp = (texto: string) => {
    const resolved = resolveMessage(texto, client.name)
    window.open(buildWAUrl(client.phone, resolved), '_blank')
  }

  if (loading) return <div className="h-32 card animate-pulse max-w-2xl" />

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h4 className="text-sm font-semibold">Mensajes para {client.name}</h4>
        <p className="text-xs text-muted mt-0.5">
          Elige la situación y envíalo: se abre WhatsApp con el mensaje listo y tú confirmas el envío. Puedes ajustar el texto solo para {client.name}.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map(t => {
          const override = overrides[t.id]
          const effectiveText = override ?? t.texto
          return (
            <div key={t.id} className="card p-4 space-y-3">
              <p className="text-sm font-semibold">{t.nombre}</p>

              {editingClient === t.id ? (
                <div className="space-y-1.5">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
                    className="w-full px-2.5 py-2 bg-bg border border-accent/40 rounded-lg text-sm outline-none resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingClient(null)} className="flex-1 py-2 border border-border rounded-lg text-xs text-muted">Cancelar</button>
                    <button onClick={async () => { await setOverride(t.id, draft); setEditingClient(null); toast(`Personalizado para ${client.name} ✓`, 'ok') }}
                      className="flex-1 py-2 bg-accent text-white rounded-lg text-xs font-semibold">Guardar solo para {client.name}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm italic text-ink/80">"{resolveMessage(effectiveText, client.name)}"</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => sendWhatsApp(effectiveText)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] text-white rounded-lg text-sm font-bold">
                      <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
                    </button>
                    {override !== undefined ? (
                      <>
                        <span className="text-xs text-accent font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Personalizado</span>
                        <button onClick={() => { setEditingClient(t.id); setDraft(override) }} className="text-xs text-muted hover:text-accent underline">Editar</button>
                        <button onClick={() => removeOverride(t.id)} className="text-xs text-muted hover:text-warn underline">Quitar personalización</button>
                      </>
                    ) : (
                      <button onClick={() => { setEditingClient(t.id); setDraft(t.texto) }} className="text-xs text-muted hover:text-accent underline">Personalizar para {client.name}</button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Las plantillas generales afectan a TODOS los clientes, así que viven
          plegadas aparte: lo habitual aquí es enviar, no reescribirlas. */}
      <details className="card group">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-muted hover:text-ink list-none flex items-center justify-between gap-2">
          <span>Plantillas generales</span>
          <span className="text-xs font-normal">Afectan a todos tus clientes</span>
        </summary>
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          {templates.map(t => (
            <div key={t.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t.nombre}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingDefault(t.id); setDraft(t.texto) }} aria-label={`Editar plantilla ${t.nombre}`} className="p-1.5 text-muted hover:text-accent"><Pencil className="w-3.5 h-3.5" /></button>
                  {t.tipo === 'custom' && <button onClick={() => deleteTemplate(t.id)} aria-label={`Eliminar plantilla ${t.nombre}`} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
              {editingDefault === t.id ? (
                <div className="space-y-1.5">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
                    className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingDefault(null)} className="flex-1 py-2 border border-border rounded-lg text-xs text-muted">Cancelar</button>
                    <button onClick={async () => { await saveTemplate(t.id, draft); setEditingDefault(null); toast('Plantilla actualizada ✓', 'ok') }}
                      className="flex-1 py-2 bg-ink text-white rounded-lg text-xs font-semibold">Guardar para todos</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">{t.texto}</p>
              )}
            </div>
          ))}

          {addingCustom ? (
            <div className="space-y-1.5 border border-dashed border-border rounded-xl p-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre de la plantilla"
                className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none" />
              <textarea value={newText} onChange={e => setNewText(e.target.value)} rows={3} placeholder="Texto del mensaje... usa {{cliente}} para el nombre"
                className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => { setAddingCustom(false); setNewName(''); setNewText('') }} className="flex-1 py-2 border border-border rounded-lg text-xs text-muted">Cancelar</button>
                <button onClick={async () => { if (!newName.trim() || !newText.trim()) return; await addTemplate(newName.trim(), newText.trim()); setAddingCustom(false); setNewName(''); setNewText('') }}
                  className="flex-1 py-2 bg-ink text-white rounded-lg text-xs font-semibold">Crear</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCustom(true)}
              className="w-full border-2 border-dashed border-border rounded-xl py-2 text-xs text-muted hover:border-accent hover:text-accent flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Crear plantilla personalizada
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
