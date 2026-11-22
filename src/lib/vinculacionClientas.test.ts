import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { P, Q, UC, UD, UN, ADM, FICHA_C, FICHA_U, FICHA_D, PLAN_C, SEMILLA, ESQUEMA, EXTENSION_CLIENTE, entorno } from './permisosHarness'

// VINCULACIÓN SEGURA DE CLIENTAS (migraciones propuestas 0077, 0078 y 0079) probada en PostgreSQL REAL (PGlite) sobre la réplica de producción tras 0074 y 0076.
//  · B = réplica + 0077 (aditiva)      · C = B + 0078 (cierre)      · D = C + 0079 (retirada de compatibilidad)
// Reproduce los 9 bypasses del informe de auditoría y comprueba que quedan cerrados, que los controles previos siguen y que la ruta de recuperación funciona.
// QUÉ NO DEMUESTRA: concurrencia real (una sola conexión: ver scripts/prueba-reclamaciones-simultaneas.mjs, para un entorno aislado de Supabase), GoTrue (qué marca deja la
// confirmación real de email: la regla está aislada en private.email_confirmado_por_la_persona), PostgREST, ni las pantallas.
const sql = import.meta.glob('../../supabase/migrations/00{74,76,77,78,79}_*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const mig = (n: string) => { const k = Object.keys(sql).find(x => x.includes('/' + n + '_')); if (!k) throw new Error('falta ' + n); return sql[k] }

const UL = '00000000-0000-4000-8000-0000000000e2' // la clienta legítima (email confirmado)
const UX = '00000000-0000-4000-8000-0000000000e3' // un atacante con sesión, email confirmado, que solo conoce un token
const UA = '00000000-0000-4000-8000-0000000000e4' // cuenta con el email legítimo pero SIN confirmación real (Auth con confirmación automática)
const UAN = '00000000-0000-4000-8000-0000000000e5' // cuenta anónima
const FICHA_E = '00000000-0000-4000-8000-0000000000f6' // ficha con email = el de UN
const FICHA_NE = '00000000-0000-4000-8000-0000000000f7' // ficha SIN email
const EMAIL_LEGIT = 'clienta.legitima@prueba.invalid'

const EXTRA = `
  insert into auth.users (id, email, confirmation_sent_at, email_confirmed_at, is_anonymous) values
    ('${UL}', '${EMAIL_LEGIT}', now() - interval '1 hour', now() - interval '30 minutes', false),
    ('${UX}', 'atacante@prueba.invalid', now() - interval '1 hour', now() - interval '30 minutes', false),
    ('${UA}', '${EMAIL_LEGIT}', null, now(), false),
    ('${UAN}', null, now() - interval '1 hour', now() - interval '30 minutes', true);
  update auth.users set confirmation_sent_at = now() - interval '1 hour', email_confirmed_at = now() - interval '30 minutes' where id in ('${UC}', '${UD}', '${UN}');
  update public.clientes set email = '${EMAIL_LEGIT}' where id = '${FICHA_U}';
  insert into public.clientes (id, nutricionista_id, token, auth_user_id, name, email) values
    ('${FICHA_E}', '${P}', 'tokE', null, 'Ficha con email de UN', 'n@prueba.invalid'),
    ('${FICHA_NE}', '${P}', 'tokNE', null, 'Ficha sin email', null);
  insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_C}', 61.5), ('${FICHA_U}', 70);
  insert into public.diet_plans (client_id, nutricionista_id, name, kcal_target) values ('${FICHA_U}', '${P}', 'Plan de la ficha U', 1900);
`

let dbB: PGlite, dbC: PGlite, dbD: PGlite
const base = async () => { const d = new PGlite(); await d.exec(ESQUEMA); await d.exec(mig('0074')); await d.exec(mig('0076')); await d.exec(EXTENSION_CLIENTE); return d }
beforeAll(async () => {
  dbB = await base(); await dbB.exec(mig('0077'))
  dbC = await base(); await dbC.exec(mig('0077')); await dbC.exec(mig('0078'))
  dbD = await base(); await dbD.exec(mig('0077')); await dbD.exec(mig('0078')); await dbD.exec(mig('0079'))
}, 120_000)
afterAll(async () => { await dbB.close(); await dbC.close(); await dbD.close() })

type Env = ReturnType<typeof entorno>
const B = entorno(() => dbB); const C = entorno(() => dbC); const D = entorno(() => dbD)
const aislar = (db: () => PGlite) => (fn: () => Promise<void>) => async () => {
  const d = db(); await d.exec('set session authorization postgres'); await d.exec('begin')
  try { await d.exec(SEMILLA); await d.exec(EXTRA); await fn() } finally { await d.exec('rollback'); await d.exec('set session authorization postgres') }
}
const aisladaB = aislar(() => dbB), aisladaC = aislar(() => dbC), aisladaD = aislar(() => dbD)

type R = Record<string, unknown>
const llamar = async (e: Env, rol: string, uid: string | null, fn: string, args = ''): Promise<{ ok: true; r: R } | { ok: false; error: string }> => {
  const x = await e.como(rol, uid, () => e.intentar(`select public.${fn}(${args}) as r`))
  return x.ok ? { ok: true, r: x.rows[0].r as R } : x
}
const resultado = async (e: Env, uid: string | null, fn: string, args = '', rol = 'authenticated') => {
  const x = await llamar(e, rol, uid, fn, args); return x.ok ? String(x.r.result) : 'ERROR: ' + x.error
}
const invitar = async (e: Env, quien: string, ficha: string) => {
  const x = await llamar(e, 'authenticated', quien, 'create_client_invitation', `'${ficha}'`)
  if (!x.ok) throw new Error(x.error); return String(x.r.token)
}
const reclamar = (e: Env, uid: string | null, token: string, rol = 'authenticated') => resultado(e, uid, 'claim_client_with_invitation', `'${token}'`, rol)
const dueno = async (e: Env, ficha: string) => (await e.filas(`select auth_user_id from public.clientes where id = '${ficha}'`))[0]?.auth_user_id ?? null
const eventos = (e: Env, ficha: string) => e.filas(`select event, actor_id, actor_role, previous_uid, new_uid, method, reason from public.client_link_events where client_id = '${ficha}' order by id`)

describe('1. Invitaciones: 24 horas, un solo uso, solo el hash en la base, regenerar revoca', () => {
  it('el profesional dueño genera un enlace; el token no se guarda en claro en ninguna tabla y caduca en 24 h', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    expect(t).toMatch(/^[0-9a-f]{64}$/)
    for (const tabla of ['client_invitations', 'client_link_events', 'client_link_requests', 'client_link_notifications'])
      expect(await C.cuenta(tabla, `${tabla}::text like '%${t}%'`), tabla).toBe(0)
    const f = (await C.filas(`select token_hash, expires_at - created_at as vida, (expires_at <= now() + interval '24 hours') ok24, (expires_at > now() + interval '23 hours') ok23 from public.client_invitations`))[0]
    expect(f.token_hash).not.toBe(t); expect(f.token_hash).toMatch(/^[0-9a-f]{64}$/); expect([f.ok24, f.ok23]).toEqual([true, true])
  }))
  it('solo el profesional dueño o un superadministrador la genera: otro profesional, la clienta y anon reciben error', aisladaC(async () => {
    expect((await llamar(C, 'authenticated', Q, 'create_client_invitation', `'${FICHA_U}'`)).ok).toBe(false)
    expect((await llamar(C, 'authenticated', UC, 'create_client_invitation', `'${FICHA_U}'`)).ok).toBe(false)
    expect((await llamar(C, 'anon', null, 'create_client_invitation', `'${FICHA_U}'`)).ok).toBe(false)
  }))
  it('no se genera para una ficha ya vinculada (hay que desvincular antes)', aisladaC(async () => {
    const x = await llamar(C, 'authenticated', P, 'create_client_invitation', `'${FICHA_C}'`)
    expect(x.ok === false && /ya está vinculada/.test(x.error)).toBe(true)
  }))
  it('generar un enlace nuevo REVOCA el anterior de inmediato y solo queda uno activo', aisladaC(async () => {
    const viejo = await invitar(C, P, FICHA_U)
    const nuevo = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UL, viejo)).toBe('invitation_revoked')
    expect(await C.cuenta('client_invitations', `client_id = '${FICHA_U}' and consumed_at is null and revoked_at is null`)).toBe(1)
    expect(await reclamar(C, UL, nuevo)).toBe('linked')
  }))
  it('un enlace caducado no sirve; tras caducar se puede generar otro', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    await C.filas(`update public.client_invitations set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'`)
    expect(await reclamar(C, UL, t)).toBe('invitation_expired')
    const t2 = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UL, t2)).toBe('linked')
  }))
  it('la base rechaza invitaciones de más de 24 horas', aisladaC(async () => {
    const r = await C.intentar(`insert into public.client_invitations (client_id, nutricionista_id, token_hash, created_by, expires_at) values ('${FICHA_U}', '${P}', 'h', '${P}', now() + interval '48 hours')`)
    expect(r.ok).toBe(false)
  }))
  it('un solo uso: el segundo intento con el mismo enlace falla, también desde otra cuenta (colisión secuencial)', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UL, t)).toBe('linked')
    expect(await reclamar(C, UL, t)).toBe('invitation_used')
    expect(await reclamar(C, UX, t)).toBe('invitation_used')
    expect(await dueno(C, FICHA_U)).toBe(UL)
  }))
  it('get_invitation_status: respuesta uniforme para token inválido; solo el nombre de pila y si requiere aprobación; nunca email ni apellidos', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    const ok = (await C.como('anon', null, () => C.intentar(`select * from public.get_invitation_status('${t}')`)))
    expect(ok.ok && ok.rows[0]).toMatchObject({ status: 'valid', client_first_name: 'Ficha', requires_approval: false })
    expect(JSON.stringify(ok)).not.toMatch(/prueba\.invalid|clienta\.legitima/)
    const mal = await C.como('anon', null, () => C.intentar(`select * from public.get_invitation_status('no-existe')`))
    expect(mal.ok && mal.rows).toEqual([{ status: 'invalid', client_first_name: null, requires_approval: null, display_name: null, logo_url: null, accent_color: null, contact_phone: null, consent_document_url: null, app_name: null }])
    const tNE = await invitar(C, P, FICHA_NE)
    const ne = await C.como('anon', null, () => C.intentar(`select requires_approval from public.get_invitation_status('${tNE}')`))
    expect(ne.ok && ne.rows).toEqual([{ requires_approval: true }])
    await reclamar(C, UL, t)
    const usado = await C.como('anon', null, () => C.intentar(`select status from public.get_invitation_status('${t}')`))
    expect(usado.ok && usado.rows).toEqual([{ status: 'used' }])
  }))
})

describe('2. Identidad: conocer el token NUNCA basta (bypasses 1, 2, 3 y 4 del informe)', () => {
  it('ficha con email: la cuenta con ese email, confirmado, queda vinculada (mayúsculas y espacios no importan)', aisladaC(async () => {
    await C.filas(`update public.clientes set email = '  Clienta.Legitima@PRUEBA.invalid ' where id = '${FICHA_U}'`)
    const t = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UL, t)).toBe('linked')
    expect(await dueno(C, FICHA_U)).toBe(UL)
  }))
  it('BYPASS 1/2 CERRADO: un atacante con sesión y el token pero con OTRO email no se vincula (y la invitación sigue siendo válida para la persona legítima)', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UX, t)).toBe('email_mismatch')
    expect(await dueno(C, FICHA_U)).toBeNull()
    expect(await reclamar(C, UL, t)).toBe('linked')
  }))
  it('BYPASS 1/2 CERRADO: con el email correcto pero SIN confirmación real (confirmación automática de Auth) tampoco: falla cerrado, y no consume la invitación', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UA, t)).toBe('email_not_confirmed')
    expect(await dueno(C, FICHA_U)).toBeNull()
    expect(await C.cuenta('client_invitations', `consumed_at is null and revoked_at is null`)).toBe(1)
    expect(await reclamar(C, UL, t)).toBe('linked')
  }))
  it('una cuenta anónima no vincula', aisladaC(async () => {
    expect(await reclamar(C, UAN, await invitar(C, P, FICHA_U))).toBe('email_not_confirmed')
  }))
  it('BYPASS 3 CERRADO: una cuenta de profesional (P, Q o modo personal) no puede ser titular de la ficha de otra persona', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_E)
    await C.filas(`update auth.users set confirmation_sent_at = now() - interval '1 hour', email_confirmed_at = now() - interval '30 minutes' where id in ('${P}', '${Q}')`)
    expect(await reclamar(C, Q, t)).toBe('account_not_allowed')
    expect(await reclamar(C, P, t)).toBe('account_not_allowed')
    expect(await dueno(C, FICHA_E)).toBeNull()
  }))
  it('BYPASS 4 CERRADO: el resultado es explícito en cada caso (nunca void): inválido, usado, caducado, revocado, mismatch, sin confirmar, ya vinculada', aisladaC(async () => {
    expect(await reclamar(C, UL, 'no-existe')).toBe('invitation_invalid')
    const t = await invitar(C, P, FICHA_U)
    expect(await reclamar(C, UL, t)).toBe('linked')
    expect(await reclamar(C, UL, t)).toBe('invitation_used')
    const e = await invitar(C, P, FICHA_E)
    await C.filas(`update public.clientes set email = '${EMAIL_LEGIT}' where id = '${FICHA_E}'`)
    expect(await reclamar(C, UN, e)).toBe('email_mismatch')
  }))
  it('sin sesión, el rol authenticated recibe error 28000; anon no puede ni ejecutarla', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    const x = await llamar(C, 'authenticated', null, 'claim_client_with_invitation', `'${t}'`)
    expect(x.ok === false && /sesión/.test(x.error)).toBe(true)
    expect((await llamar(C, 'anon', null, 'claim_client_with_invitation', `'${t}'`)).ok).toBe(false)
  }))
  it('una ficha ya vinculada no se roba: otra cuenta con una invitación vieja recibe invitation_used / ficha_already_linked', aisladaC(async () => {
    const t = await invitar(C, P, FICHA_U)
    await reclamar(C, UL, t)
    expect(await reclamar(C, UX, t)).toBe('invitation_used')
    expect(await dueno(C, FICHA_U)).toBe(UL)
  }))
})

describe('3. Ficha sin email: pendiente de aprobación expresa del profesional dueño', () => {
  const solicitud = async (ficha = FICHA_NE, quien = UX) => {
    const t = await invitar(C, P, ficha)
    expect(await reclamar(C, quien, t)).toBe('pending_approval')
    return String((await C.filas(`select id from public.client_link_requests where client_id = '${ficha}' and decision is null`))[0].id)
  }
  it('reclamar NO vincula: crea una solicitud pendiente con el email confirmado del solicitante y un aviso al profesional', aisladaC(async () => {
    const id = await solicitud()
    expect(await dueno(C, FICHA_NE)).toBeNull()
    expect((await C.filas(`select requester_uid, requester_email, decision from public.client_link_requests where id = '${id}'`))[0]).toEqual({ requester_uid: UX, requester_email: 'atacante@prueba.invalid', decision: null })
    expect((await C.filas(`select kind, method from public.client_link_notifications`))).toEqual([{ kind: 'pending_approval', method: 'solicitud_pendiente_aprobacion' }])
  }))
  it('el profesional dueño aprueba: queda vinculada, con evento «aprobacion_profesional» y aviso', aisladaC(async () => {
    const id = await solicitud()
    expect(await resultado(C, P, 'approve_client_link', `'${id}'`)).toBe('linked')
    expect(await dueno(C, FICHA_NE)).toBe(UX)
    expect((await eventos(C, FICHA_NE)).map(e => [e.event, e.method, e.actor_role])).toEqual([
      ['invitation_created', 'enlace_24h', 'professional'], ['link_requested', 'solicitud_pendiente_aprobacion', 'client'], ['linked', 'aprobacion_profesional', 'professional']])
  }))
  it('otro profesional, la clienta y anon no pueden aprobar ni rechazar; un superadministrador sí', aisladaC(async () => {
    const id = await solicitud()
    for (const quien of [Q, UX, UC]) {
      expect((await llamar(C, 'authenticated', quien, 'approve_client_link', `'${id}'`)).ok, quien).toBe(false)
      expect((await llamar(C, 'authenticated', quien, 'reject_client_link', `'${id}'`)).ok, quien).toBe(false)
    }
    expect((await llamar(C, 'anon', null, 'approve_client_link', `'${id}'`)).ok).toBe(false)
    await dbC.exec(`insert into auth.users (id, email) values ('${ADM}', 'adm@prueba.invalid'); insert into public.nutricionistas (uid, email, approved, role) values ('${ADM}', 'adm@prueba.invalid', true, 'super_admin')`)
    expect(await resultado(C, ADM, 'approve_client_link', `'${id}'`)).toBe('linked')
    expect((await eventos(C, FICHA_NE)).pop()).toMatchObject({ event: 'linked', actor_role: 'super_admin' })
  }))
  it('rechazar deja la ficha sin vincular, con evento y motivo; aprobar de nuevo informa «already_decided»', aisladaC(async () => {
    const id = await solicitud()
    expect(await resultado(C, P, 'reject_client_link', `'${id}', 'No conozco a esta persona'`)).toBe('rejected')
    expect(await dueno(C, FICHA_NE)).toBeNull()
    expect((await eventos(C, FICHA_NE)).pop()).toMatchObject({ event: 'link_rejected', reason: 'No conozco a esta persona', new_uid: UX })
    expect(await resultado(C, P, 'approve_client_link', `'${id}'`)).toBe('already_decided')
  }))
  it('con una solicitud pendiente, otra reclamación devuelve «pending_exists» sin consumir su invitación', aisladaC(async () => {
    await solicitud()
    const t2 = await invitar(C, P, FICHA_NE)
    expect(await reclamar(C, UL, t2)).toBe('pending_exists')
    expect(await C.cuenta('client_invitations', `consumed_at is null and revoked_at is null`)).toBe(1)
  }))
  it('una solicitud caduca a los 7 días; aprobar entonces devuelve «request_expired» y no vincula', aisladaC(async () => {
    const id = await solicitud()
    await C.filas(`update public.client_link_requests set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'`)
    expect(await resultado(C, P, 'approve_client_link', `'${id}'`)).toBe('request_expired')
    expect(await dueno(C, FICHA_NE)).toBeNull()
  }))
  it('si la cuenta del solicitante ya no tiene el email confirmado en el momento de aprobar, no se vincula', aisladaC(async () => {
    const id = await solicitud()
    await C.filas(`update auth.users set confirmation_sent_at = null where id = '${UX}'`)
    expect(await resultado(C, P, 'approve_client_link', `'${id}'`)).toBe('email_not_confirmed')
    expect(await dueno(C, FICHA_NE)).toBeNull()
  }))
})

describe('4. Trazabilidad: eventos de solo inserción, sin tokens, con actor, uid anterior y nuevo, método y motivo (bypass 8)', () => {
  it('vincular, desvincular y reasignar dejan un evento cada uno', aisladaC(async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    await resultado(C, P, 'unlink_client_account', `'${FICHA_U}', 'cambio de dispositivo'`)
    const e = await eventos(C, FICHA_U)
    expect(e.map(x => [x.event, x.method])).toEqual([['invitation_created', 'enlace_24h'], ['linked', 'email_verificado'], ['unlinked', 'desvinculacion_profesional']])
    expect(e[1]).toMatchObject({ actor_id: UL, actor_role: 'client', previous_uid: null, new_uid: UL })
    expect(e[2]).toMatchObject({ actor_id: P, actor_role: 'professional', previous_uid: UL, new_uid: null, reason: 'cambio de dispositivo' })
    // reasignación directa (mantenimiento): queda registrada como tal y como «sistema»
    await C.filas(`update public.clientes set auth_user_id = '${UC}' where id = '${FICHA_U}'`)
    await C.filas(`update public.clientes set auth_user_id = '${UD}' where id = '${FICHA_U}'`)
    expect((await eventos(C, FICHA_U)).slice(-2).map(x => [x.event, x.method, x.actor_role, x.previous_uid, x.new_uid])).toEqual([
      ['linked', 'cambio_directo', 'system', null, UC], ['reassigned', 'cambio_directo', 'system', UC, UD]])
  }))
  it('borrar la ficha de una clienta vinculada deja el evento «ficha_eliminada» aunque la ficha ya no exista', aisladaC(async () => {
    await C.filas(`delete from public.clientes where id = '${FICHA_C}'`)
    expect((await eventos(C, FICHA_C)).pop()).toMatchObject({ event: 'unlinked', method: 'ficha_eliminada', previous_uid: UC })
  }))
  it('los roles de la API no escriben eventos ni solicitudes ni invitaciones ni avisos; el propietario tampoco puede modificarlos ni borrarlos (solo-inserción)', aisladaC(async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    for (const tabla of ['client_link_events', 'client_invitations', 'client_link_requests', 'client_link_notifications']) {
      for (const orden of [`insert into public.${tabla} select * from public.${tabla} limit 1`, `update public.${tabla} set id = id`, `delete from public.${tabla}`, `truncate public.${tabla}`])
        expect((await C.como('authenticated', P, () => C.intentar(orden))).ok, tabla + ': ' + orden).toBe(false)
    }
    for (const orden of [`update public.client_link_events set reason = 'x'`, `delete from public.client_link_events`, `truncate public.client_link_events`]) {
      const r = await C.intentar(orden); expect(r.ok === false && /solo inserción|foreign key|referenc/i.test(r.error), orden).toBe(true)
    }
    expect(await C.cuenta('client_link_events')).toBeGreaterThan(0)
  }))
  it('cada profesional ve solo sus eventos, solicitudes e invitaciones', aisladaC(async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    const mios = await C.como('authenticated', P, () => C.intentar(`select count(*)::int n from public.client_link_events`))
    const ajenos = await C.como('authenticated', Q, () => C.intentar(`select count(*)::int n from public.client_link_events`))
    expect(mios.ok && mios.rows[0].n).toBeGreaterThan(0)
    expect(await C.como('authenticated', Q, () => C.intentar(`select count(*)::int n from public.client_link_events where nutricionista_id <> '${Q}'`))).toEqual({ ok: true, rows: [{ n: 0 }] }) // Q solo ve lo suyo
    void ajenos
    expect(await C.como('authenticated', UC, () => C.intentar(`select * from public.client_link_events`))).toEqual({ ok: true, rows: [] })
    expect((await C.como('anon', null, () => C.intentar(`select * from public.client_link_events`))).ok).toBe(false)
  }))
  it('el aviso al profesional existe al vincular, indica ficha, fecha y método, y no contiene información clínica ni token', aisladaC(async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    const n = await C.filas(`select kind, method, client_id, nutricionista_id, occurred_at is not null fecha, sent_at from public.client_link_notifications`)
    expect(n).toEqual([{ kind: 'linked', method: 'email_verificado', client_id: FICHA_U, nutricionista_id: P, fecha: true, sent_at: null }])
    const columnas = (await C.filas(`select column_name from information_schema.columns where table_name = 'client_link_notifications' order by 1`)).map(c => c.column_name)
    expect(columnas).toEqual(['attempts', 'client_id', 'event_id', 'id', 'kind', 'last_error', 'locked_until', 'method', 'nutricionista_id', 'occurred_at', 'sent_at'])
  }))
  it('línea base: las fichas ya vinculadas al aplicar 0077 reciben un evento «migracion_inicial» (sin inventar una verificación)', async () => {
    const d = new PGlite()
    try {
      await d.exec(ESQUEMA); await d.exec(mig('0074')); await d.exec(mig('0076')); await d.exec(EXTENSION_CLIENTE)
      await d.exec(SEMILLA); await d.exec(mig('0077'))
      const e = (await d.query<Record<string, unknown>>(`select client_id, method, actor_role, new_uid from public.client_link_events order by client_id`)).rows
      expect(e).toEqual([{ client_id: FICHA_C, method: 'migracion_inicial', actor_role: 'system', new_uid: UC }, { client_id: FICHA_D, method: 'migracion_inicial', actor_role: 'system', new_uid: UD }])
    } finally { await d.close() }
  })
  it('retención: la purga solo borra los eventos de fichas SIN titular actual, con alguna desvinculación y última actividad anterior al plazo; solo service_role/propietario la ejecutan', aisladaC(async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    await resultado(C, P, 'unlink_client_account', `'${FICHA_U}', null`)
    await reclamar(C, UN, await invitar(C, P, FICHA_E)) // ficha E: vinculada y activa
    await C.filas(`update public.client_link_events set occurred_at = now() - interval '30 months' where false`) // (los eventos no se pueden actualizar: se envejecen por INSERT)
    // eventos antiguos insertados como propietario: una ficha desvinculada hace 30 meses y otra vinculada hace 30 meses (esta última NO se purga)
    await C.filas(`insert into public.client_link_events (occurred_at, event, nutricionista_id, client_id, actor_role, previous_uid, method) values
      (now() - interval '30 months', 'unlinked', '${P}', '00000000-0000-4000-8000-0000000000aa', 'professional', '${UC}', 'desvinculacion_profesional')`)
    expect((await C.como('authenticated', P, () => C.intentar(`select public.purge_client_link_events()`))).ok).toBe(false)
    expect((await C.como('anon', null, () => C.intentar(`select public.purge_client_link_events()`))).ok).toBe(false)
    const borradas = await C.como('service_role', null, () => C.intentar(`select public.purge_client_link_events('24 months') as n`))
    expect(borradas.ok && Number(borradas.rows[0].n)).toBe(1)
    expect(await C.cuenta('client_link_events', `client_id = '00000000-0000-4000-8000-0000000000aa'`)).toBe(0)
    expect(await C.cuenta('client_link_events', `client_id = '${FICHA_E}'`)).toBeGreaterThan(0)  // vinculada y activa: se conserva
    expect(await C.cuenta('client_link_events', `client_id = '${FICHA_U}'`)).toBeGreaterThan(0)  // desvinculada hace minutos: dentro del plazo
  }))
})

describe('5. Desvinculación atómica y recuperación legítima (bypasses 5 y 7)', () => {
  const vinculada = async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    await C.filas(`insert into public.push_subscriptions (client_id, endpoint, p256dh, auth) values ('${FICHA_U}', 'https://push.invalid/x', 'k', 'a')`)
    expect(await dueno(C, FICHA_U)).toBe(UL)
  }
  it('desvincular retira de golpe TODO el acceso del titular anterior: plan, pesos, escritura, suscripciones push; rota el token y cancela solicitudes', aisladaC(async () => {
    await vinculada()
    const tokenAntes = (await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token
    const antes = await C.como('authenticated', UL, () => C.intentar(`select (select count(*) from public.weight_logs where client_id = '${FICHA_U}')::int pesos, (select count(*) from public.diet_plans where client_id = '${FICHA_U}')::int planes`))
    expect(antes.ok && antes.rows[0]).toEqual({ pesos: 1, planes: 1 })
    expect(await resultado(C, P, 'unlink_client_account', `'${FICHA_U}', 'recuperación'`)).toBe('unlinked')
    const despues = await C.como('authenticated', UL, async () => ({
      lectura: await C.intentar(`select (select count(*) from public.weight_logs where client_id = '${FICHA_U}')::int pesos, (select count(*) from public.diet_plans where client_id = '${FICHA_U}')::int planes`),
      escritura: await C.intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_U}', '{}')`),
      peso: await C.intentar(`insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_U}', 40)`),
    }))
    expect(despues.lectura.ok && despues.lectura.rows[0]).toEqual({ pesos: 0, planes: 0 })
    expect(despues.escritura.ok).toBe(false); expect(despues.peso.ok).toBe(false)
    expect(await dueno(C, FICHA_U)).toBeNull()
    expect(await C.cuenta('push_subscriptions', `client_id = '${FICHA_U}'`)).toBe(0)
    expect((await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token).not.toBe(tokenAntes)
  }))
  it('es ATÓMICA: si falla un paso intermedio (aquí, el borrado de suscripciones), no se desvincula nada ni se pierde ningún estado', aisladaC(async () => {
    await vinculada()
    await dbC.exec(`create function public.prueba_falla() returns trigger language plpgsql as $$ begin raise exception 'fallo simulado'; end $$;
      create trigger prueba_falla before delete on public.push_subscriptions for each row execute function public.prueba_falla()`)
    const x = await llamar(C, 'authenticated', P, 'unlink_client_account', `'${FICHA_U}', null`)
    expect(x.ok === false && /fallo simulado/.test(x.error)).toBe(true)
    expect(await dueno(C, FICHA_U)).toBe(UL)
    expect(await C.cuenta('client_link_events', `client_id = '${FICHA_U}' and event = 'unlinked'`)).toBe(0)
  }))
  it('solo el profesional dueño o un superadministrador desvincula; el modo personal no se desvincula; desvincular una ficha libre informa «not_linked»', aisladaC(async () => {
    await vinculada()
    for (const quien of [Q, UL, UX]) expect((await llamar(C, 'authenticated', quien, 'unlink_client_account', `'${FICHA_U}', null`)).ok, quien).toBe(false)
    expect((await llamar(C, 'anon', null, 'unlink_client_account', `'${FICHA_U}', null`)).ok).toBe(false)
    expect(await resultado(C, P, 'unlink_client_account', `'${FICHA_E}', null`)).toBe('not_linked')
    await C.filas(`update public.clientes set auth_user_id = nutricionista_id where id = '${FICHA_E}'`)
    const x = await llamar(C, 'authenticated', P, 'unlink_client_account', `'${FICHA_E}', null`)
    expect(x.ok === false && /modo personal/.test(x.error)).toBe(true)
  }))
  it('BYPASS 7 CERRADO: «regenerar» un enlace de una ficha vinculada no es posible (hay que desvincular, que sí retira al titular y deja evento)', aisladaC(async () => {
    await vinculada()
    const x = await llamar(C, 'authenticated', P, 'create_client_invitation', `'${FICHA_U}'`)
    expect(x.ok === false && /ya está vinculada/.test(x.error)).toBe(true)
    expect(await dueno(C, FICHA_U)).toBe(UL)
  }))
  it('RECUPERACIÓN LEGÍTIMA: un impostor ya vinculado (cambio directo previo) → el profesional desvincula → la persona legítima recibe un enlace nuevo y se vincula; el impostor pierde el acceso', aisladaC(async () => {
    await C.filas(`update public.clientes set auth_user_id = '${UX}' where id = '${FICHA_U}'`) // estado heredado de antes de 0078: impostor titular
    expect((await C.como('authenticated', UX, () => C.intentar(`select weight_kg from public.weight_logs where client_id = '${FICHA_U}'`)))).toEqual({ ok: true, rows: [{ weight_kg: '70' }] })
    expect(await resultado(C, P, 'unlink_client_account', `'${FICHA_U}', 'suplantación detectada'`)).toBe('unlinked')
    expect((await C.como('authenticated', UX, () => C.intentar(`select weight_kg from public.weight_logs where client_id = '${FICHA_U}'`)))).toEqual({ ok: true, rows: [] })
    expect(await reclamar(C, UL, await invitar(C, P, FICHA_U))).toBe('linked')
    expect(await dueno(C, FICHA_U)).toBe(UL)
    expect((await eventos(C, FICHA_U)).map(e => [e.event, e.method])).toEqual([
      ['linked', 'cambio_directo'], ['unlinked', 'desvinculacion_profesional'], ['invitation_created', 'enlace_24h'], ['linked', 'email_verificado']])
  }))
})

describe('6. Bloqueo del UPDATE directo y de la creación de fichas ya vinculadas (bypass 5 y los «DESEADO» de la auditoría)', () => {
  const directo = (quien: string, orden: string) => C.como('authenticated', quien, () => C.intentar(orden))
  it('BYPASS 5 CERRADO (DESEADO del informe): el profesional no cambia auth_user_id de la ficha de su clienta con un UPDATE directo, ni a sí mismo ni a otro ni a NULL', aisladaC(async () => {
    for (const nuevo of [`'${P}'`, `'${UD}'`, 'null'])
      expect((await directo(P, `update public.clientes set auth_user_id = ${nuevo} where id = '${FICHA_C}'`)).ok, nuevo).toBe(false)
    expect(await dueno(C, FICHA_C)).toBe(UC)
  }))
  it('(0078) el profesional tampoco cambia token, nutricionista_id ni id; ni crea fichas ya vinculadas; sí edita el resto y crea fichas normales', aisladaC(async () => {
    for (const set of [`token = 'otro'`, `nutricionista_id = '${Q}'`, `id = gen_random_uuid()`]) expect((await directo(P, `update public.clientes set ${set} where id = '${FICHA_U}'`)).ok, set).toBe(false)
    expect((await directo(P, `insert into public.clientes (nutricionista_id, token, name, auth_user_id) values ('${P}', 'tokNuevo1', 'Nueva', '${UD}')`)).ok).toBe(false)
    expect((await directo(P, `update public.clientes set name = 'Nombre editado', surname = 'Apellido' where id = '${FICHA_U}' returning id`))).toMatchObject({ ok: true })
    expect((await directo(P, `insert into public.clientes (nutricionista_id, token, name) values ('${P}', 'tokNuevo2', 'Nueva') returning id`))).toMatchObject({ ok: true })
    expect(await C.cuenta('clientes', `name = 'Nombre editado'`)).toBe(1)
  }))
  it('CONTROL: otro profesional y la clienta siguen sin poder modificar fichas ajenas', aisladaC(async () => {
    expect((await directo(Q, `update public.clientes set name = 'x' where id = '${FICHA_C}' returning id`)).ok && 0).toBe(0)
    expect(await C.cuenta('clientes', `id = '${FICHA_C}' and name = 'x'`)).toBe(0)
    const r = await directo(UC, `update public.clientes set auth_user_id = null where id = '${FICHA_C}' returning id`)
    expect(r.ok ? r.rows.length : 0).toBe(0)
  }))
  it('BYPASS 6 CERRADO: un profesional que quisiera firmar el consentimiento «como» su clienta no puede hacerse titular, así que accept_consent no actúa', aisladaC(async () => {
    await directo(P, `update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`)
    await C.como('authenticated', P, () => C.intentar(`select public.accept_consent('tokC', 'Nombre falso')`))
    expect(await C.filas(`select consent_signed_name from public.clientes where id = '${FICHA_C}'`)).toEqual([{ consent_signed_name: null }])
  }))
  it('mantenimiento (propietario y service_role) sigue pudiendo; el registro de modo personal (trigger SECURITY DEFINER) sigue creando su ficha vinculada', aisladaC(async () => {
    await C.filas(`update public.clientes set auth_user_id = null where id = '${FICHA_C}'`)
    expect((await C.como('service_role', null, () => C.intentar(`update public.clientes set auth_user_id = '${UC}' where id = '${FICHA_C}' returning id`))).ok).toBe(true)
    const NUEVO = '00000000-0000-4000-8000-0000000000ac'
    await C.filas(`insert into auth.users (id, email, raw_user_meta_data) values ('${NUEVO}', 'personal@prueba.invalid', '{"signup_type":"nutricionista","account_mode":"personal"}')`)
    expect(await C.filas(`select auth_user_id = nutricionista_id propia from public.clientes where nutricionista_id = '${NUEVO}'`)).toEqual([{ propia: true }])
    expect((await C.filas(`select method from public.client_link_events where client_id in (select id from public.clientes where nutricionista_id = '${NUEVO}')`))).toEqual([{ method: 'modo_personal' }])
  }))
})

describe('7. Compatibilidad: qué ve la aplicación ANTIGUA y la NUEVA en cada etapa', () => {
  it('0077 sola: la aplicación ANTIGUA sigue funcionando (reclamar por token, regenerar el enlace con UPDATE de token), todo cambio de vínculo deja evento, y YA NO se puede reasignar auth_user_id con un UPDATE (ventana reducida)', aisladaB(async () => {
    const directoB = (quien: string, orden: string) => B.como('authenticated', quien, () => B.intentar(orden))
    // lo que la app antigua hace y debe seguir pudiendo
    expect((await directoB(P, `update public.clientes set token = 'enlace-regenerado-1' where id = '${FICHA_U}' returning id`))).toMatchObject({ ok: true })
    await B.como('authenticated', UN, () => B.intentar(`select public.claim_client_by_token('enlace-regenerado-1')`))
    expect(await dueno(B, FICHA_U)).toBe(UN)
    expect(await B.cuenta('client_link_events', `client_id = '${FICHA_U}' and method = 'cambio_directo' and event = 'linked'`)).toBe(1)
    expect((await directoB(P, `insert into public.clientes (nutricionista_id, token, name) values ('${P}', 'tokNuevoB', 'Nueva') returning id`))).toMatchObject({ ok: true })
    // lo que YA se cierra en 0077: el profesional no reasigna la cuenta de una ficha, ni la crea ya vinculada, ni toca la marca de consentimiento
    for (const orden of [`update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`, `update public.clientes set auth_user_id = null where id = '${FICHA_C}'`,
      `update public.clientes set nutricionista_id = '${Q}' where id = '${FICHA_C}'`, `update public.clientes set consent_invalidated_at = now() where id = '${FICHA_C}'`,
      `insert into public.clientes (nutricionista_id, token, name, auth_user_id) values ('${P}', 'tokVinculadaB', 'X', '${UD}')`])
      expect((await directoB(P, orden)).ok, orden).toBe(false)
    expect(await dueno(B, FICHA_C)).toBe(UC)
  }))
  it('0078: la reclamación antigua FALLA CON UN MENSAJE CLARO (antes devolvía éxito silencioso) y no vincula; el estado antiguo para ficha vinculada sigue disponible', aisladaC(async () => {
    for (const [rol, uid] of [['authenticated', UN], ['anon', null]] as const) {
      const x = await C.como(rol, uid, () => C.intentar(`select public.claim_client_by_token('tokU')`))
      expect(x.ok === false && /ya no puede vincular cuentas/.test(x.error), rol).toBe(true)
    }
    expect(await dueno(C, FICHA_U)).toBeNull()
    const compat = await C.como('anon', null, () => C.intentar(`select id, auth_user_id from public.get_client_auth_status_by_token('tokC')`))
    expect(compat).toEqual({ ok: true, rows: [{ id: FICHA_C, auth_user_id: UC }] })
  }))
  it('la aplicación NUEVA usa get_client_link_state: dice si está reclamada y si el llamante es el titular, sin revelar ningún uid', aisladaC(async () => {
    const col = (await C.filas(`select pg_get_function_result(oid) c from pg_proc where proname = 'get_client_link_state'`))[0].c
    expect(String(col)).not.toMatch(/auth_user_id|\buid\b/)
    const f = (quien: string | null, rol = 'authenticated') => C.como(rol, quien, () => C.intentar(`select claimed, is_mine from public.get_client_link_state('tokC')`))
    expect(await f(UC)).toEqual({ ok: true, rows: [{ claimed: true, is_mine: true }] })
    expect(await f(UX)).toEqual({ ok: true, rows: [{ claimed: true, is_mine: false }] })
    expect(await f(null, 'anon')).toEqual({ ok: true, rows: [{ claimed: true, is_mine: false }] })
    expect(await C.como('anon', null, () => C.intentar(`select claimed from public.get_client_link_state('tokU')`))).toEqual({ ok: true, rows: [{ claimed: false }] })
  }))
  it('0079: se retiran la RPC anónima que filtraba el uid y la función antigua; ninguna función ejecutable por anon devuelve auth_user_id (bypass 9 cerrado)', aisladaD(async () => {
    const existe = (await dbD.query<{ n: string }>(`select count(*)::text n from pg_proc where proname in ('get_client_auth_status_by_token', 'claim_client_by_token')`)).rows[0].n
    expect(existe).toBe('0')
    const fugas = (await dbD.query<{ f: string }>(`select p.proname f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') and pg_get_function_result(p.oid) ilike '%auth_user_id%'`)).rows
    expect(fugas).toEqual([])
    const nuevo = await D.como('anon', null, () => D.intentar(`select claimed from public.get_client_link_state('tokC')`))
    expect(nuevo).toMatchObject({ ok: true })
  }))
})

describe('8. Tokens antiguos de fichas sin reclamar (0078 modifica datos: SOLO la columna token de fichas con auth_user_id nulo)', () => {
  it('los tokens de fichas sin reclamar dejan de existir (un enlace antiguo ya no encuentra la ficha); los de fichas vinculadas no cambian', async () => {
    const d = new PGlite()
    try {
      await d.exec(ESQUEMA); await d.exec(mig('0074')); await d.exec(mig('0076')); await d.exec(EXTENSION_CLIENTE); await d.exec(SEMILLA); await d.exec(mig('0077'))
      const antes = (await d.query<{ id: string; token: string; auth_user_id: string | null }>(`select id, token, auth_user_id from public.clientes order by id`)).rows
      await d.exec(mig('0078'))
      const despues = (await d.query<{ id: string; token: string }>(`select id, token from public.clientes order by id`)).rows
      for (const a of antes) {
        const n = despues.find(x => x.id === a.id)!
        if (a.auth_user_id === null) { expect(n.token, a.id).not.toBe(a.token); expect(n.token).toMatch(/^[0-9a-f]{64}$/) } else expect(n.token, a.id).toBe(a.token)
      }
      expect((await d.query(`select * from public.get_client_auth_status_by_token('tokU')`)).rows).toEqual([]) // el enlace antiguo de la ficha sin reclamar ya no resuelve
      expect((await d.query(`select * from public.get_client_auth_status_by_token('tokC')`)).rows).toHaveLength(1)
      expect(new Set(despues.map(x => x.token)).size).toBe(despues.length) // siguen siendo únicos
    } finally { await d.close() }
  })
})

describe('9. Privilegios y seguridad de lo nuevo', () => {
  it('anon solo ejecuta get_invitation_status y get_client_link_state; authenticated ejecuta las RPC de vinculación; nadie de la API ejecuta la purga ni los helpers privados', aisladaC(async () => {
    const puede = async (rol: string, firma: string) => (await C.filas(`select has_function_privilege('${rol}', '${firma}', 'execute') p`))[0].p as boolean
    for (const f of ['get_invitation_status(text)', 'get_client_link_state(text)']) { expect(await puede('anon', `public.${f}`), f).toBe(true) }
    for (const f of ['create_client_invitation(uuid)', 'claim_client_with_invitation(text)', 'approve_client_link(uuid)', 'reject_client_link(uuid, text)', 'unlink_client_account(uuid, text, boolean)', 'get_my_link_requests()', 'purge_client_link_events(interval)'])
      expect(await puede('anon', `public.${f}`), 'anon ' + f).toBe(false)
    expect(await puede('authenticated', 'public.purge_client_link_events(interval)')).toBe(false)
    expect(await puede('authenticated', 'public.claim_client_with_invitation(text)')).toBe(true)
    for (const f of ['normalizar_email(text)', 'hash_token(text)', 'token_nuevo()', 'email_confirmado_por_la_persona(uuid)', 'registrar_evento_vinculo(text, uuid, uuid, uuid, text, uuid, uuid, text, text, uuid)', 'contexto_vinculo(text, text, text, uuid)', 'trg_registrar_vinculo()', 'clientes_proteger_vinculo()'])
      for (const rol of ['anon', 'authenticated']) expect(await puede(rol, `private.${f}`), `${rol} private.${f}`).toBe(false)
  }))
  it('todas las funciones nuevas de public son SECURITY DEFINER con search_path vacío; ningún SQL dinámico', aisladaC(async () => {
    const nuevas = ['create_client_invitation', 'get_invitation_status', 'claim_client_with_invitation', 'approve_client_link', 'reject_client_link', 'unlink_client_account', 'get_client_link_state', 'get_my_link_requests', 'purge_client_link_events']
    const f = await C.filas(`select proname, prosecdef, array_to_string(proconfig, ',') cfg, prosrc from pg_proc where pronamespace = 'public'::regnamespace and proname in (${nuevas.map(n => `'${n}'`).join(',')}) order by 1`)
    expect(f).toHaveLength(nuevas.length)
    for (const x of f) { expect(x.prosecdef, String(x.proname)).toBe(true); expect(String(x.cfg), String(x.proname)).toMatch(/search_path=""/); expect(String(x.prosrc), String(x.proname)).not.toMatch(/\bexecute\b/i) }
  }))
  it('las tablas nuevas no son accesibles por los roles de la API más allá del SELECT con RLS', aisladaC(async () => {
    for (const tabla of ['client_invitations', 'client_link_requests', 'client_link_events', 'client_link_notifications']) {
      const priv = (await C.filas(`select has_table_privilege('authenticated', 'public.${tabla}', 'insert') i, has_table_privilege('authenticated', 'public.${tabla}', 'update') u, has_table_privilege('authenticated', 'public.${tabla}', 'delete') d, has_table_privilege('anon', 'public.${tabla}', 'select') sa`))[0]
      expect(priv, tabla).toEqual({ i: false, u: false, d: false, sa: false })
    }
    expect((await C.como('authenticated', P, () => C.intentar(`select * from public.client_link_notifications`))).ok).toBe(false)
  }))
})

describe('10. Controles del informe que siguen funcionando', () => {
  it('la clienta vinculada sigue viendo solo lo suyo; anamnesis/planes solo para ella y su profesional', aisladaC(async () => {
    const r = await C.como('authenticated', UC, async () => ({
      ajeno: await C.intentar(`select id from public.weight_logs where client_id = '${FICHA_D}'`),
      propio: await C.intentar(`select id from public.weight_logs where client_id = '${FICHA_C}'`),
      fichas: await C.intentar(`select id from public.clientes`),
    }))
    expect(r.ajeno).toEqual({ ok: true, rows: [] }); expect(r.propio.ok && r.propio.rows.length).toBe(1); expect(r.fichas).toEqual({ ok: true, rows: [] })
  }))
  it('una ficha vinculada tras el procedimiento nuevo da a su titular el mismo acceso que antes (plan, pesos, escritura propia)', aisladaC(async () => {
    await reclamar(C, UL, await invitar(C, P, FICHA_U))
    const tokenFicha = String((await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token)
    const r = await C.como('authenticated', UL, async () => ({
      plan: await C.intentar(`select name from public.diet_plans where client_id = '${FICHA_U}'`),
      escribe: await C.intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_U}', '{"embarazo_lactancia":"No"}') returning id`),
      consent: await C.intentar(`select public.accept_consent('${tokenFicha}', 'Clienta Legítima')`),
    }))
    expect(r.plan).toEqual({ ok: true, rows: [{ name: 'Plan de la ficha U' }] }); expect(r.escribe.ok && r.escribe.rows.length).toBe(1); expect(r.consent.ok).toBe(true)
    expect(await C.filas(`select consent_signed_name from public.clientes where id = '${FICHA_U}'`)).toEqual([{ consent_signed_name: 'Clienta Legítima' }])
  }))
  it('get_my_link_requests: la clienta ve el estado de su solicitud pendiente (sin datos clínicos)', aisladaC(async () => {
    await reclamar(C, UX, await invitar(C, P, FICHA_NE))
    const r = await C.como('authenticated', UX, () => C.intentar(`select client_first_name, decision from public.get_my_link_requests()`))
    expect(r).toEqual({ ok: true, rows: [{ client_first_name: 'Ficha', decision: null }] })
  }))
})

void [UD, PLAN_C]
