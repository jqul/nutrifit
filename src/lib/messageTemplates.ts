import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { messageTemplateFromRow } from './mappers'
import { MessageTemplate, MessageType } from '../types'

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  nuevo_plan: 'Nuevo plan de dieta', racha: 'Felicitar racha', checkin_recordatorio: 'Recordatorio de check-in', custom: 'Personalizado',
}

const DEFAULTS: { tipo: MessageType; nombre: string; texto: string }[] = [
  { tipo: 'nuevo_plan', nombre: 'Nuevo plan asignado', texto: 'Hola {{cliente}} 👋 Te he preparado un nuevo plan de dieta, ¡échale un vistazo cuando puedas! 🥗' },
  { tipo: 'racha', nombre: 'Felicitar racha', texto: '¡{{cliente}}, menuda racha llevas! 🔥 Sigue así, se nota el esfuerzo.' },
  { tipo: 'checkin_recordatorio', nombre: 'Recordatorio de check-in', texto: 'Hola {{cliente}}, no olvides rellenar tu check-in de hoy en tu panel 📋' },
]

/** Sustituye los placeholders del mensaje por los datos reales del cliente. */
export function resolveMessage(texto: string, clientName: string): string {
  return texto.replace(/\{\{\s*cliente\s*\}\}/gi, clientName)
}

function demoTemplates(nutricionistaId: string): MessageTemplate[] {
  return DEFAULTS.map((d, i) => ({
    id: `demo-msg-${i}`, nutricionistaId, tipo: d.tipo, nombre: d.nombre, texto: d.texto, createdAt: Date.now(),
  }))
}

export function useMessageTemplates(nutricionistaId?: string, demoMode?: boolean) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(
    demoMode && nutricionistaId ? demoTemplates(nutricionistaId) : []
  )
  const [loading, setLoading] = useState(!demoMode)

  const load = useCallback(async () => {
    if (demoMode) return
    if (!nutricionistaId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('message_templates').select('*').eq('nutricionista_id', nutricionistaId).order('created_at')
    let rows = (data || []).map(messageTemplateFromRow)
    if (rows.length === 0) {
      const { data: inserted } = await supabase.from('message_templates').insert(
        DEFAULTS.map(d => ({ nutricionista_id: nutricionistaId, tipo: d.tipo, nombre: d.nombre, texto: d.texto }))
      ).select('*')
      if (inserted) rows = inserted.map(messageTemplateFromRow)
    }
    setTemplates(rows)
    setLoading(false)
  }, [nutricionistaId, demoMode])

  useEffect(() => { load() }, [load])

  const saveTemplate = useCallback(async (id: string, texto: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, texto } : t))
    if (demoMode) return
    await supabase.from('message_templates').update({ texto }).eq('id', id)
  }, [demoMode])

  const addTemplate = useCallback(async (nombre: string, texto: string) => {
    if (!nutricionistaId) return
    if (demoMode) {
      setTemplates(prev => [...prev, { id: `demo-msg-${Date.now()}`, nutricionistaId, tipo: 'custom', nombre, texto, createdAt: Date.now() }])
      return
    }
    const { data } = await supabase.from('message_templates')
      .insert({ nutricionista_id: nutricionistaId, tipo: 'custom', nombre, texto }).select('*').single()
    if (data) setTemplates(prev => [...prev, messageTemplateFromRow(data)])
  }, [nutricionistaId, demoMode])

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (demoMode) return
    await supabase.from('message_templates').delete().eq('id', id)
  }, [demoMode])

  return { templates, loading, saveTemplate, addTemplate, deleteTemplate, reload: load }
}
