import { describe, it, expect } from 'vitest'
import { buildLinkMessage } from '../../supabase/functions/notify-client-link/message'

describe('aviso al profesional de una vinculación', () => {
  const base = { occurredAt: '2026-11-21T10:30:00Z', clientName: 'María López' }
  it('vinculación: indica ficha, fecha y método de verificación, y nada más', () => {
    const m = buildLinkMessage({ ...base, kind: 'linked', method: 'email_verificado' })
    expect(m.title).toBe('Cuenta vinculada')
    expect(m.body).toContain('María López'); expect(m.body).toContain('email verificado'); expect(m.body).toMatch(/21 nov/); expect(m.body).toMatch(/11:30|10:30/) // hora de Madrid
    expect(m.url).toBe('/')
  })
  it('solicitud pendiente: pide aprobar en la ficha', () => {
    const m = buildLinkMessage({ ...base, kind: 'pending_approval', method: 'solicitud_pendiente_aprobacion' })
    expect(m.title).toMatch(/Solicitud/); expect(m.body).toMatch(/aprobación/)
  })
  it('aprobada por el profesional se describe como tal; un método desconocido no inventa nada', () => {
    expect(buildLinkMessage({ ...base, kind: 'linked', method: 'aprobacion_profesional' }).body).toContain('aprobada por ti')
    expect(buildLinkMessage({ ...base, kind: 'linked', method: 'x' }).body).toContain('verificada')
  })
  it('sin información clínica, emails ni tokens; el nombre se limpia y se recorta', () => {
    const m = buildLinkMessage({ ...base, kind: 'linked', method: 'email_verificado', clientName: 'Ana\nGómez ' + 'x'.repeat(200) })
    expect(m.body).not.toMatch(/\n|@|token|embarazo|alergia|peso|kcal/i)
    expect(m.body.length).toBeLessThan(160)
    expect(buildLinkMessage({ ...base, kind: 'linked', method: 'email_verificado', clientName: '  ' }).body).toContain('Una clienta')
  })
})
