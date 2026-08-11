import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ClientData, DailyCheckin } from '../types'
import { clientFromRow, clientToRow, checkinFromRow } from '../lib/mappers'
import { calcAdherence, calcStreak } from '../lib/adherence'
import { toast } from '../components/shared/Toast'
import { DEMO_CHECKINS } from '../lib/demo-data'

export interface ClientWithStats extends ClientData {
  lastCheckin?: string
  doneToday?: boolean
  adherence7d?: number
  streak?: number
}

interface Options {
  nutricionistaId: string
  demoClients?: ClientData[]
}

function withStats(clients: ClientData[], checkinsMap: Record<string, DailyCheckin[]>): ClientWithStats[] {
  const today = new Date()
  const todayStr = toLocalISODate(today)
  return clients.map(c => {
    const checkins = checkinsMap[c.id] || []
    const sorted = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
    return {
      ...c,
      lastCheckin: sorted[0]?.date,
      doneToday: sorted[0]?.date === todayStr,
      adherence7d: calcAdherence(checkins, 7, today),
      streak: calcStreak(checkins, today),
    }
  })
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface NewClientInput {
  name: string
  surname: string
  phone: string
  email: string
  goal: string
  heightCm: string
  gender: string
  birthDate: string
  allergies: string
}

export function useNutricionistaClients({ nutricionistaId, demoClients }: Options) {
  const [clients, setClients] = useState<ClientWithStats[]>(
    demoClients ? withStats(demoClients, DEMO_CHECKINS) : []
  )
  const [loading, setLoading] = useState(!demoClients)

  const fetchClients = useCallback(async () => {
    if (demoClients) return
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').eq('nutricionista_id', nutricionistaId)
    if (error) { console.error(error); toast('No se pudieron cargar los clientes', 'warn'); setLoading(false); return }
    const mapped = (data || []).map(clientFromRow)

    if (mapped.length) {
      const ids = mapped.map(c => c.id)
      const { data: checkinRows } = await supabase.from('daily_checkins').select('*').in('client_id', ids)
      const checkinsByClient: Record<string, DailyCheckin[]> = {}
      ;(checkinRows || []).forEach((row) => {
        const c = checkinFromRow(row)
        ;(checkinsByClient[c.clientId] ||= []).push(c)
      })
      const today = new Date()
      const todayStr = toLocalISODate(today)
      setClients(mapped.map(c => {
        const checkins = checkinsByClient[c.id] || []
        const sorted = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
        return {
          ...c,
          lastCheckin: sorted[0]?.date,
          doneToday: sorted[0]?.date === todayStr,
          adherence7d: calcAdherence(checkins, 7, today),
          streak: calcStreak(checkins, today),
        }
      }))
    } else {
      setClients([])
    }
    setLoading(false)
  }, [nutricionistaId])

  useEffect(() => {
    if (demoClients) return
    fetchClients()
    const channel = supabase.channel('clientes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes', filter: `nutricionista_id=eq.${nutricionistaId}` }, fetchClients)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [nutricionistaId, demoClients, fetchClients])

  const addClient = async (newClient: NewClientInput) => {
    const token = Math.random().toString(36).slice(2, 14)
    if (demoClients) {
      const demoClient: ClientData = {
        id: `demo-new-${Date.now()}`, nutricionistaId, token,
        authUserId: null, name: newClient.name.trim(), surname: newClient.surname.trim(),
        phone: newClient.phone.trim(), email: newClient.email.trim(),
        goal: newClient.goal.trim() || null, heightCm: newClient.heightCm ? parseFloat(newClient.heightCm) : null,
        gender: newClient.gender || null, birthDate: newClient.birthDate || null,
        allergies: newClient.allergies.trim(), notes: '', monthlyPrice: null, goalWeightKg: null, customMessages: {},
        createdAt: Date.now(),
      }
      setClients(prev => [...prev, ...withStats([demoClient], {})])
      toast('Cliente añadido (modo demo — no se guarda)', 'ok')
      return true
    }
    const { error } = await supabase.from('clientes').insert({
      nutricionista_id: nutricionistaId,
      token,
      name: newClient.name.trim(),
      surname: newClient.surname.trim(),
      phone: newClient.phone.trim(),
      email: newClient.email.trim() || null,
      goal: newClient.goal.trim() || null,
      height_cm: newClient.heightCm ? parseFloat(newClient.heightCm) : null,
      gender: newClient.gender || null,
      birth_date: newClient.birthDate || null,
      allergies: newClient.allergies.trim(),
      notes: '',
      created_at: new Date().toISOString(),
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return false }
    toast('Cliente creado ✓', 'ok')
    await fetchClients()
    return true
  }

  const updateClient = async (id: string, updates: Partial<ClientData>) => {
    if (demoClients) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
      toast('Cambios aplicados (modo demo — no se guardan)', 'ok')
      return true
    }
    const row = clientToRow(updates)
    const { error } = await supabase.from('clientes').update(row).eq('id', id)
    if (error) { toast('Error: ' + error.message, 'warn'); return false }
    await fetchClients()
    return true
  }

  const deleteClient = async (id: string) => {
    if (demoClients) {
      setClients(prev => prev.filter(c => c.id !== id))
      toast('Cliente eliminado (modo demo — no se guarda)', 'ok')
      return true
    }
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { toast('Error al eliminar el cliente', 'warn'); return false }
    await fetchClients()
    toast('Cliente eliminado', 'ok')
    return true
  }

  const regenerateToken = async (id: string) => {
    const token = Math.random().toString(36).slice(2, 14)
    if (demoClients) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, token } : c))
      toast('Enlace regenerado (modo demo — no se guarda)', 'ok')
      return token
    }
    const { error } = await supabase.from('clientes').update({ token }).eq('id', id)
    if (error) { toast('Error al regenerar el enlace', 'warn'); return null }
    await fetchClients()
    toast('Enlace regenerado — el anterior ha dejado de funcionar', 'ok')
    return token
  }

  return { clients, loading, fetchClients, addClient, updateClient, deleteClient, regenerateToken }
}
