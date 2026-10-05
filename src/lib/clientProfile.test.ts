import { describe, it, expect } from 'vitest'
import { clienteRowFromProfile, clientFromRow } from './mappers'
import { ClientProfileRow } from './supabase-types'

const profile: ClientProfileRow = {
  id: 'c1', nutricionista_id: 'n1', token: 'tok', auth_user_id: 'u1',
  name: 'María', surname: 'Torres', phone: '600', email: 'm@x.es',
  birth_date: '1990-01-01', gender: 'mujer', height_cm: 165, goal: 'perder_peso', allergies: 'nueces',
  goal_weight_kg: 62, consent_accepted_at: null, consent_signed_name: null, created_at: '2026-08-01T00:00:00Z',
}

describe('clienteRowFromProfile', () => {
  it('keeps the public fields untouched', () => {
    const row = clienteRowFromProfile(profile)
    expect(row.name).toBe('María')
    expect(row.nutricionista_id).toBe('n1')
    expect(row.goal_weight_kg).toBe(62)
  })

  it('leaves every nutritionist-internal field empty', () => {
    const row = clienteRowFromProfile(profile)
    expect(row.notes).toBeNull()
    expect(row.report_notes).toBeNull()
    expect(row.notes_updated_at).toBeNull()
    expect(row.monthly_price).toBeNull()
    expect(row.custom_messages).toBeNull()
    expect(row.tags).toEqual([])
    expect(row.last_reviewed_at).toBeNull()
  })

  it('produces a ClientData the app can use, with no private data in it', () => {
    const data = clientFromRow(clienteRowFromProfile(profile))
    expect(data.notes).toBe('')
    expect(data.reportNotes).toBe('')
    expect(data.monthlyPrice).toBeNull()
    expect(data.tags).toEqual([])
  })
})
