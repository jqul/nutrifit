import { describe, it, expect } from 'vitest'
import { processNotifications, type Deps, type LinkNotificationRow, type PushSub } from '../../supabase/functions/notify-client-link/process'

const PRO = '00000000-0000-4000-8000-0000000000a1'
const OTRO = '00000000-0000-4000-8000-0000000000b1'
const fila = (id: number, extra: Partial<LinkNotificationRow> = {}): LinkNotificationRow =>
  ({ id, nutricionista_id: PRO, client_id: 'ficha-' + id, kind: 'linked', method: 'email_verificado', occurred_at: '2026-11-21T10:30:00Z', ...extra })
const sub = (id: string, endpoint = 'https://push.invalid/' + id): PushSub => ({ id, endpoint, p256dh: 'k', auth: 'a' })

/** Dobles de las dependencias que registran todo lo que ocurre. */
function doble(over: Partial<Deps> & { rows?: LinkNotificationRow[]; subs?: Record<string, PushSub[]>; failing?: Record<string, number> } = {}) {
  const log = { finish: [] as [number, boolean, string | null][], sent: [] as [string, string][], removed: [] as string[], subsAsked: [] as string[], names: [] as string[] }
  const deps: Deps = {
    take: async () => over.rows ?? [],
    clientName: async (id) => { log.names.push(id); return 'María López' },
    subscriptions: async (n) => { log.subsAsked.push(n); return over.subs?.[n] ?? [] },
    send: async (s, p) => { log.sent.push([s.id, p]); const code = over.failing?.[s.id]; if (code) throw Object.assign(new Error('push ' + code), { statusCode: code }) },
    removeSubscription: async (id) => { log.removed.push(id) },
    finish: async (id, ok, err) => { log.finish.push([id, ok, err]) },
    ...over,
  }
  return { deps, log }
}

describe('bandeja de avisos de vinculación: envío, errores, reintentos, duplicados y destinatario', () => {
  it('éxito: envía a los dispositivos del profesional destinatario y marca enviado', async () => {
    const { deps, log } = doble({ rows: [fila(1)], subs: { [PRO]: [sub('s1'), sub('s2')] } })
    expect(await processNotifications(deps)).toEqual({ taken: 1, sent: 1, withoutDevices: 0, failed: 0 })
    expect(log.finish).toEqual([[1, true, null]]); expect(log.sent.map(s => s[0]).sort()).toEqual(['s1', 's2'])
  })
  it('DESTINATARIO: solo se piden las suscripciones del profesional al que va dirigido el aviso, nunca de otro ni de la clienta', async () => {
    const { deps, log } = doble({ rows: [fila(1), fila(2, { nutricionista_id: OTRO })], subs: { [PRO]: [sub('p1')], [OTRO]: [sub('o1')] } })
    await processNotifications(deps)
    expect(log.subsAsked).toEqual([PRO, OTRO])
    // cada dispositivo recibe solo el aviso de su dueño
    expect(log.sent.map(s => s[0])).toEqual(['p1', 'o1'])
  })
  it('sin dispositivos suscritos: se da por tratado con una nota (la solicitud y el historial siguen en la ficha)', async () => {
    const { deps, log } = doble({ rows: [fila(1)] })
    expect(await processNotifications(deps)).toMatchObject({ withoutDevices: 1, sent: 0, failed: 0 })
    expect(log.finish).toEqual([[1, true, 'sin suscripciones push']])
  })
  it('ERROR del servicio de push en todos los dispositivos: queda SIN enviar y con el error anotado (se reintentará al caducar la reserva)', async () => {
    const { deps, log } = doble({ rows: [fila(1)], subs: { [PRO]: [sub('s1'), sub('s2')] }, failing: { s1: 500, s2: 503 } })
    expect(await processNotifications(deps)).toMatchObject({ sent: 0, failed: 1 })
    expect(log.finish).toEqual([[1, false, 'ningún dispositivo aceptó el aviso']]); expect(log.removed).toEqual([])
  })
  it('un dispositivo caducado (410) se elimina y, si otro acepta, el aviso cuenta como enviado; si todos están caducados, se eliminan y se reintenta', async () => {
    const a = doble({ rows: [fila(1)], subs: { [PRO]: [sub('viejo'), sub('bueno')] }, failing: { viejo: 410 } })
    expect(await processNotifications(a.deps)).toMatchObject({ sent: 1 }); expect(a.log.removed).toEqual(['viejo'])
    const b = doble({ rows: [fila(1)], subs: { [PRO]: [sub('v1'), sub('v2')] }, failing: { v1: 404, v2: 410 } })
    expect(await processNotifications(b.deps)).toMatchObject({ failed: 1 }); expect(b.log.removed.sort()).toEqual(['v1', 'v2'])
  })
  it('un aviso que lanza una excepción no impide los demás y queda anotado', async () => {
    let n = 0
    const { deps, log } = doble({ rows: [fila(1), fila(2)], subs: { [PRO]: [sub('s1')] }, clientName: async () => { if (++n === 1) throw new Error('base caída'); return 'Ana' } })
    expect(await processNotifications(deps)).toMatchObject({ taken: 2, sent: 1, failed: 1 })
    expect(log.finish[0]).toEqual([1, false, 'Error: base caída']); expect(log.finish[1]).toEqual([2, true, null])
  })
  it('un error al reservar los avisos NO se traga: la función responde con error (no se pierde nada)', async () => {
    const { deps } = doble({ take: async () => { throw new Error('rpc falló') } })
    await expect(processNotifications(deps)).rejects.toThrow('rpc falló')
  })
  it('DUPLICADOS (1): un dispositivo suscrito dos veces recibe un solo aviso', async () => {
    const { deps, log } = doble({ rows: [fila(1)], subs: { [PRO]: [sub('a', 'https://push.invalid/mismo'), sub('b', 'https://push.invalid/mismo')] } })
    await processNotifications(deps); expect(log.sent).toHaveLength(1)
  })
  it('DUPLICADOS (2): dos ejecuciones simultáneas con el arrendamiento de la base reparten los avisos sin repetir ninguno', async () => {
    const pendientes = [fila(1), fila(2), fila(3), fila(4)]
    const enviados: string[] = []
    const take = async (limit: number) => pendientes.splice(0, Math.min(limit, 2)) // como FOR UPDATE SKIP LOCKED + reserva: lo reservado no vuelve a salir
    const mk = () => doble({ take, subs: { [PRO]: [sub('s1')] }, send: async (_s, p) => { enviados.push(p) } })
    const [x, y] = [mk(), mk()]
    const [rx, ry] = await Promise.all([processNotifications(x.deps, 2), processNotifications(y.deps, 2)])
    expect(rx.taken + ry.taken).toBe(4); expect(enviados).toHaveLength(4)
    const ids = [...x.log.finish, ...y.log.finish].map(f => f[0]).sort(); expect(ids).toEqual([1, 2, 3, 4])
  })
  it('el aviso contiene solo ficha, fecha y método: sin datos clínicos, emails ni tokens', async () => {
    const { deps, log } = doble({ rows: [fila(1, { kind: 'pending_approval', method: 'solicitud_pendiente_aprobacion' })], subs: { [PRO]: [sub('s1')] } })
    await processNotifications(deps)
    const payload = JSON.parse(log.sent[0][1]); expect(Object.keys(payload).sort()).toEqual(['body', 'title', 'url'])
    expect(log.sent[0][1]).not.toMatch(/@|token|embarazo|alergia|peso|kcal|anamnesis/i)
  })
})
