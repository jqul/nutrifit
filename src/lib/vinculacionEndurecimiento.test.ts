import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { P, Q, UC, UD, UN, FICHA_C, FICHA_U, SEMILLA, ESQUEMA, EXTENSION_CLIENTE, entorno } from './permisosHarness'

// ENDURECIMIENTO de la vinculación (0077/0078): consentimiento cuestionado por suplantación, límite de intentos, entropía de los tokens, bandeja de avisos
// (arrendamiento, reintentos, destinatario) y desvinculación completa sobre TODAS las tablas de datos del cliente y el almacenamiento.
// Estado C = réplica de producción + 0074 + 0076 + 0077 + 0078. Qué NO demuestra: GoTrue, PostgREST, Realtime ni las pantallas (ver docs/vinculacion-clientas.md).
const sql = import.meta.glob('../../supabase/migrations/00{74,76,77,78}_*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const mig = (n: string) => { const k = Object.keys(sql).find(x => x.includes('/' + n + '_')); if (!k) throw new Error('falta ' + n); return sql[k] }

const UL = '00000000-0000-4000-8000-0000000000e2' // clienta legítima, email confirmado de verdad
const UX = '00000000-0000-4000-8000-0000000000e3' // impostor
const FICHA_QU = '00000000-0000-4000-8000-0000000000f5' // ficha de Q sin reclamar, con el email de UL
const FICHA_NE = '00000000-0000-4000-8000-0000000000f7' // ficha de P SIN email
const EMAIL = 'clienta.legitima@prueba.invalid'

const EXTRA = `
  insert into auth.users (id, email, confirmation_sent_at, email_confirmed_at) values
    ('${UL}', '${EMAIL}', now() - interval '1 hour', now() - interval '30 minutes'),
    ('${UX}', 'atacante@prueba.invalid', now() - interval '1 hour', now() - interval '30 minutes');
  update auth.users set confirmation_sent_at = now() - interval '1 hour', email_confirmed_at = now() - interval '30 minutes' where id in ('${UC}', '${UD}', '${UN}');
  update public.clientes set email = '${EMAIL}' where id = '${FICHA_U}';
  insert into public.clientes (id, nutricionista_id, token, name, email) values
    ('${FICHA_QU}', '${Q}', 'tokQU', 'Clienta de Q', '${EMAIL}'),
    ('${FICHA_NE}', '${P}', 'tokNE', 'Ficha sin email', null);
`

// Tablas de datos del cliente de PRODUCCIÓN (todas con su política basada en private.is_owner_client; leídas el 2026-11-21) y el almacenamiento.
const SOLO_LECTURA = ['blood_markers', 'client_clinical_notes', 'invoices', 'lab_reports', 'plan_phases']
const LECTURA_ESCRITURA = ['cycle_logs', 'daily_checkins', 'extra_log_items', 'meal_logs', 'progress_photos', 'survey_responses', 'body_metrics', 'appointments']
const TABLAS_NUEVAS = [...SOLO_LECTURA, ...LECTURA_ESCRITURA]
const TABLAS_DATOS = `
  ${TABLAS_NUEVAS.map(t => `
    create table public.${t} (id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clientes(id) on delete cascade, dato text not null default 'x');
    alter table public.${t} enable row level security;
    create policy lee_${t} on public.${t} for select using (private.is_owner_client(client_id) or private.is_nutricionista_of_client(client_id));
    ${LECTURA_ESCRITURA.includes(t) ? `create policy escribe_${t} on public.${t} for all using (private.is_owner_client(client_id)) with check (private.is_owner_client(client_id));` : ''}
    grant all on public.${t} to anon, authenticated, service_role;`).join('\n')}
  create schema storage;
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  create policy photos_read on storage.objects for select using (bucket_id = 'photos' and (private.is_owner_client(((storage.foldername(name))[1])::uuid) or private.is_nutricionista_of_client(((storage.foldername(name))[1])::uuid)));
  create policy photos_client_write on storage.objects for insert with check (bucket_id = 'photos' and private.is_owner_client(((storage.foldername(name))[1])::uuid));
  create policy photos_client_update on storage.objects for update using (bucket_id = 'photos' and private.is_owner_client(((storage.foldername(name))[1])::uuid));
  create policy photos_client_delete on storage.objects for delete using (bucket_id = 'photos' and private.is_owner_client(((storage.foldername(name))[1])::uuid));
  grant usage on schema storage to anon, authenticated, service_role; grant all on storage.objects to anon, authenticated, service_role;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`

let db: PGlite
beforeAll(async () => {
  db = new PGlite(); await db.exec(ESQUEMA); await db.exec(mig('0074')); await db.exec(mig('0076')); await db.exec(EXTENSION_CLIENTE)
  await db.exec(mig('0077')); await db.exec(mig('0078')); await db.exec(TABLAS_DATOS)
}, 120_000)
afterAll(async () => { await db.close() })
const C = entorno(() => db)
const aislada = (fn: () => Promise<void>) => async () => {
  await db.exec('set session authorization postgres'); await db.exec('begin')
  try { await db.exec(SEMILLA); await db.exec(EXTRA); await fn() } finally { await db.exec('rollback'); await db.exec('set session authorization postgres') }
}

type R = Record<string, unknown>
const llamar = async (rol: string, uid: string | null, fn: string, args = ''): Promise<{ ok: true; r: R } | { ok: false; error: string }> => {
  const x = await C.como(rol, uid, () => C.intentar(`select public.${fn}(${args}) as r`)); return x.ok ? { ok: true, r: x.rows[0].r as R } : x
}
const res = async (uid: string | null, fn: string, args = '', rol = 'authenticated') => { const x = await llamar(rol, uid, fn, args); return x.ok ? String(x.r.result) : 'ERROR: ' + x.error }
const invitar = async (quien: string, ficha: string) => { const x = await llamar('authenticated', quien, 'create_client_invitation', `'${ficha}'`); if (!x.ok) throw new Error(x.error); return String(x.r.token) }
const reclamar = (uid: string | null, t: string, rol = 'authenticated') => res(uid, 'claim_client_with_invitation', `'${t}'`, rol)
const dueno = async (f: string) => (await C.filas(`select auth_user_id from public.clientes where id = '${f}'`))[0]?.auth_user_id ?? null
const consentimiento = async (f: string) => (await C.filas(`select consent_accepted_at is not null firmado, consent_signed_name nombre, consent_invalidated_at is not null cuestionado from public.clientes where id = '${f}'`))[0]
const efectivo = async (f: string, token: string) => {
  const nuevo = (await C.filas(`select consent_accepted_at is not null v from public.get_client_link_state('${token}')`))[0]?.v
  const antiguo = (await C.filas(`select consent_accepted_at is not null v from public.get_client_auth_status_by_token('${token}')`))[0]?.v
  void f; return { nuevo, antiguo }
}
const firma = (uid: string, token: string, nombre: string) => C.como('authenticated', uid, () => C.intentar(`select public.accept_consent('${token}', '${nombre}')`))

describe('1. Suplantación: el consentimiento de la cuenta impostora queda CUESTIONADO, sin borrar nada y sin tocar los ajenos al incidente', () => {
  it('el impostor firma; el profesional desvincula marcando suplantación: el original se conserva, queda la marca y el evento, y deja de valer como consentimiento', aislada(async () => {
    await C.filas(`update public.clientes set auth_user_id = '${UX}' where id = '${FICHA_U}'`) // estado heredado: impostor titular (cambio directo previo a 0078)
    await firma(UX, 'tokU', 'Nombre de la clienta (firmado por el impostor)')
    expect(await efectivo(FICHA_U, 'tokU')).toEqual({ nuevo: true, antiguo: true })
    const r = await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', 'suplantación detectada', true`)
    expect(r).toEqual({ ok: true, r: { result: 'unlinked', consent_invalidated: true } })
    expect(await consentimiento(FICHA_U)).toEqual({ firmado: true, nombre: 'Nombre de la clienta (firmado por el impostor)', cuestionado: true }) // el original sigue ahí
    const tokenNuevo = String((await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token)
    expect(await efectivo(FICHA_U, tokenNuevo)).toEqual({ nuevo: false, antiguo: false }) // la app ya no lo da por firmado (ni la nueva ni la antigua)
    const ev = (await C.filas(`select event, actor_id, actor_role, previous_uid, method, reason from public.client_link_events where client_id = '${FICHA_U}' and event = 'consent_invalidated'`))
    expect(ev).toEqual([{ event: 'consent_invalidated', actor_id: P, actor_role: 'professional', previous_uid: UX, method: 'suplantacion', reason: 'suplantación detectada' }])
  }))
  it('la clienta legítima, tras vincularse con un enlace nuevo, firma de nuevo y VALE; la marca de la invalidación anterior se conserva como historial', aislada(async () => {
    await C.filas(`update public.clientes set auth_user_id = '${UX}' where id = '${FICHA_U}'`)
    await firma(UX, 'tokU', 'Impostor')
    await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', null, true`)
    expect(await reclamar(UL, await invitar(P, FICHA_U))).toBe('linked')
    await C.filas(`update public.clientes set consent_invalidated_at = consent_invalidated_at - interval '1 hour'`) // (el tiempo pasa: en una sola transacción now() no avanza)
    const token = String((await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token)
    await firma(UL, token, 'Clienta Legítima')
    expect(await efectivo(FICHA_U, token)).toEqual({ nuevo: true, antiguo: true })
    expect(await consentimiento(FICHA_U)).toEqual({ firmado: true, nombre: 'Clienta Legítima', cuestionado: true }) // la marca antigua sigue como rastro
  }))
  it('NO se invalida un consentimiento firmado ANTES de la titularidad del impostor (otro titular), ni si no se marca suplantación, ni el de otras fichas', aislada(async () => {
    // la clienta legítima firmó hace 10 días; después un cambio directo la sustituyó por el impostor, que no firmó
    await C.filas(`update public.clientes set consent_accepted_at = now() - interval '10 days', consent_signed_name = 'Clienta Legítima' where id = '${FICHA_U}'`)
    await C.filas(`update public.clientes set auth_user_id = '${UX}' where id = '${FICHA_U}'`)
    // otra ficha con su propio consentimiento
    await C.filas(`update public.clientes set consent_accepted_at = now(), consent_signed_name = 'Otra' where id = '${FICHA_C}'`)
    const r = await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', 'suplantación', true`)
    expect(r).toEqual({ ok: true, r: { result: 'unlinked', consent_invalidated: false } })
    expect(await consentimiento(FICHA_U)).toEqual({ firmado: true, nombre: 'Clienta Legítima', cuestionado: false })
    expect(await consentimiento(FICHA_C)).toEqual({ firmado: true, nombre: 'Otra', cuestionado: false })
    // sin marcar suplantación, aunque el titular firmara, no se toca
    await C.filas(`update public.clientes set auth_user_id = '${UX}', consent_accepted_at = now() where id = '${FICHA_U}'`)
    expect(await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', 'cambio de email', false`)).toEqual({ ok: true, r: { result: 'unlinked', consent_invalidated: false } })
    expect((await consentimiento(FICHA_U)).cuestionado).toBe(false)
    expect(await C.cuenta('client_link_events', `event = 'consent_invalidated'`)).toBe(0)
  }))
  it('solo el profesional dueño o un superadministrador la ejecuta; la marca no se puede modificar por la API', aislada(async () => {
    await C.filas(`update public.clientes set auth_user_id = '${UX}', consent_accepted_at = now() where id = '${FICHA_U}'`)
    for (const quien of [Q, UX, UL]) expect((await llamar('authenticated', quien, 'unlink_client_account', `'${FICHA_U}', 'x', true`)).ok, quien).toBe(false)
    expect((await llamar('anon', null, 'unlink_client_account', `'${FICHA_U}', 'x', true`)).ok).toBe(false)
    await C.filas(`update public.clientes set consent_invalidated_at = now() - interval '1 day' where id = '${FICHA_U}'`)
    expect((await C.como('authenticated', P, () => C.intentar(`update public.clientes set consent_invalidated_at = null where id = '${FICHA_U}'`))).ok).toBe(false)
    expect((await C.como('authenticated', P, () => C.intentar(`update public.clientes set consent_invalidated_at = now() where id = '${FICHA_U}'`))).ok).toBe(false)
    expect(await dueno(FICHA_U)).toBe(UX)
  }))
  it('un consentimiento ya cuestionado no se vuelve a cuestionar (idempotente) y la invalidación no borra ningún registro', aislada(async () => {
    await C.filas(`update public.clientes set auth_user_id = '${UX}', consent_accepted_at = now() where id = '${FICHA_U}'`)
    await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', 's', true`)
    const antes = await C.cuenta('client_link_events', `client_id = '${FICHA_U}'`)
    await C.filas(`update public.clientes set auth_user_id = '${UN}' where id = '${FICHA_U}'`)
    expect(await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', 's2', true`)).toEqual({ ok: true, r: { result: 'unlinked', consent_invalidated: false } })
    expect(await C.cuenta('client_link_events', `client_id = '${FICHA_U}' and event = 'consent_invalidated'`)).toBe(1)
    expect(await C.cuenta('client_link_events', `client_id = '${FICHA_U}'`)).toBeGreaterThan(antes) // solo se añadieron eventos
  }))
})

describe('2. Límite de intentos y entropía de los tokens', () => {
  it('tras 10 reclamaciones FALLIDAS de una cuenta en una hora, la undécima se rechaza aunque el enlace y el email sean correctos; otra cuenta no se ve afectada', aislada(async () => {
    const bueno = await invitar(P, FICHA_U)
    for (let i = 0; i < 10; i++) expect(await reclamar(UX, 'inventado-' + i), String(i)).toBe('invitation_invalid')
    expect(await reclamar(UX, bueno)).toBe('too_many_attempts')
    expect(await dueno(FICHA_U)).toBeNull()
    expect(await reclamar(UL, bueno)).toBe('linked') // otra cuenta no se ve afectada
  }))
  it('tras una hora vuelve a poder intentarlo; las reclamaciones con éxito, las que piden confirmar el email o las pendientes NO cuentan', aislada(async () => {
    for (let i = 0; i < 10; i++) await reclamar(UX, 'x' + i)
    expect(await reclamar(UX, 'otro')).toBe('too_many_attempts')
    await C.filas(`update public.client_link_attempts set attempted_at = now() - interval '2 hours'`)
    expect(await reclamar(UX, 'otro')).toBe('invitation_invalid')
    await C.filas(`delete from public.client_link_attempts`)
    await C.filas(`update auth.users set confirmation_sent_at = null where id = '${UL}'`) // sin confirmar (confirmación automática)
    const t = await invitar(P, FICHA_U)
    for (let i = 0; i < 12; i++) expect(await reclamar(UL, t), 'sin confirmar ' + i).toBe('email_not_confirmed')
    expect(await C.cuenta('client_link_attempts')).toBe(0)
  }))
  it('los intentos no son accesibles por la API y se limpian los de más de un día', aislada(async () => {
    await reclamar(UX, 'zzz')
    expect((await C.como('authenticated', P, () => C.intentar(`select * from public.client_link_attempts`))).ok).toBe(false)
    await C.filas(`update public.client_link_attempts set attempted_at = now() - interval '3 days'`)
    await reclamar(UX, 'yyy')
    expect(await C.cuenta('client_link_attempts')).toBe(1)
  }))
  it('ENTROPÍA: 3000 tokens sin repetirse, 64 hex, estructura de dos UUID v4 (244 bits aleatorios útiles) y reparto uniforme de los dígitos aleatorios', aislada(async () => {
    const toks = (await C.filas(`select private.token_nuevo() t from generate_series(1, 3000)`)).map(x => String(x.t))
    expect(new Set(toks).size).toBe(3000)
    for (const t of toks) { expect(t).toMatch(/^[0-9a-f]{64}$/); expect(t[12]).toBe('4'); expect(t[44]).toBe('4'); expect('89ab').toContain(t[16]); expect('89ab').toContain(t[48]) }
    const cuenta = Array(16).fill(0); for (const t of toks) cuenta[parseInt(t[0], 16)]++ // un dígito sin bits fijos: esperado 187,5 por valor
    for (const n of cuenta) { expect(n).toBeGreaterThan(187.5 * 0.6); expect(n).toBeLessThan(187.5 * 1.4) }
  }))
  it('el token que ve el profesional no es el hash guardado, y dos invitaciones nunca comparten hash', aislada(async () => {
    const t1 = await invitar(P, FICHA_U); const t2 = await invitar(P, FICHA_NE)
    const h = (await C.filas(`select token_hash from public.client_invitations order by created_at, id`)).map(x => String(x.token_hash))
    expect(h).toHaveLength(2); expect(new Set(h).size).toBe(2); expect(h).not.toContain(t1); expect(h).not.toContain(t2)
    expect((await C.filas(`select encode(sha256(convert_to('${t1}', 'UTF8')), 'hex') = '${h[0]}' or encode(sha256(convert_to('${t1}', 'UTF8')), 'hex') = '${h[1]}' ok`))[0].ok).toBe(true)
  }))
})

describe('3. Bandeja de avisos en la base: destinatario, arrendamiento, reintentos y autorización', () => {
  const take = (limit = 50) => C.como('service_role', null, () => C.intentar(`select id, nutricionista_id, attempts from public.take_link_notifications(${limit}) order by id`))
  const fin = (id: number, ok: boolean, err: string | null) => C.como('service_role', null, () => C.intentar(`select public.finish_link_notification(${id}, ${ok}, ${err === null ? 'null' : `'${err}'`})`))
  it('DESTINATARIO: el aviso va al profesional dueño de la ficha, no a quien reclama ni a otro profesional', aislada(async () => {
    await reclamar(UL, await invitar(P, FICHA_U))
    await reclamar(UL, await invitar(Q, FICHA_QU)) // UL no puede vincular otra ficha por email? (mismo email): se vincula, y el aviso va a Q
    const n = await C.filas(`select client_id, nutricionista_id from public.client_link_notifications order by id`)
    expect(n).toEqual([{ client_id: FICHA_U, nutricionista_id: P }, { client_id: FICHA_QU, nutricionista_id: Q }])
  }))
  it('solo avisan las vinculaciones normales y las solicitudes: no los cambios directos, el modo personal, las desvinculaciones ni las invitaciones', aislada(async () => {
    await C.filas(`update public.clientes set auth_user_id = '${UX}' where id = '${FICHA_U}'`)
    await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', null, false`)
    await invitar(P, FICHA_U)
    expect(await C.cuenta('client_link_notifications')).toBe(0)
    await reclamar(UX, await invitar(P, FICHA_NE)) // ficha sin email → solicitud
    const id = String((await C.filas(`select id from public.client_link_requests where decision is null`))[0].id)
    await res(P, 'approve_client_link', `'${id}'`)
    expect((await C.filas(`select kind from public.client_link_notifications order by id`)).map(x => x.kind)).toEqual(['pending_approval', 'linked'])
  }))
  it('ARRENDAMIENTO: lo reservado no vuelve a salir (sin duplicados); respeta el límite; tras caducar la reserva se reintenta contando el intento', aislada(async () => {
    for (const f of [FICHA_U, FICHA_NE]) await reclamar(f === FICHA_U ? UL : UX, await invitar(P, f))
    const a = await take(1); expect(a.ok && a.rows.length).toBe(1)
    const b = await take(); expect(b.ok && b.rows.length).toBe(1) // solo queda el otro
    expect(a.ok && b.ok && a.rows[0].id !== b.rows[0].id).toBe(true)
    expect(await take()).toEqual({ ok: true, rows: [] })
    await C.filas(`update public.client_link_notifications set locked_until = now() - interval '1 minute'`) // caduca la reserva (por ejemplo, el repartidor se cayó)
    const c = await take(); expect(c.ok && c.rows.map(r => r.attempts)).toEqual([2, 2])
  }))
  it('REINTENTOS: tras 5 intentos fallidos el aviso deja de ofrecerse; un envío correcto lo cierra y es idempotente', aislada(async () => {
    await reclamar(UL, await invitar(P, FICHA_U))
    const id = Number((await C.filas(`select id from public.client_link_notifications`))[0].id)
    for (let i = 1; i <= 5; i++) {
      const t = await take(); expect(t.ok && t.rows.length, 'intento ' + i).toBe(1)
      await fin(id, false, 'ningún dispositivo aceptó el aviso')
    }
    expect(await take()).toEqual({ ok: true, rows: [] })
    expect((await C.filas(`select attempts, sent_at, last_error from public.client_link_notifications`))[0]).toMatchObject({ attempts: 5, sent_at: null, last_error: 'ningún dispositivo aceptó el aviso' })
    await C.filas(`update public.client_link_notifications set attempts = 1`)
    await fin(id, true, null); await fin(id, false, 'tarde') // el segundo cierre no deshace el primero
    const f = (await C.filas(`select sent_at is not null enviado, last_error from public.client_link_notifications`))[0]
    expect(f).toEqual({ enviado: true, last_error: null }); expect(await take()).toEqual({ ok: true, rows: [] })
  }))
  it('AUTORIZACIÓN: solo service_role reserva y cierra avisos; la API (profesional, clienta, anon) no puede ni leer la bandeja', aislada(async () => {
    await reclamar(UL, await invitar(P, FICHA_U))
    for (const [rol, uid] of [['authenticated', P], ['authenticated', Q], ['authenticated', UL], ['anon', null]] as const) {
      expect((await C.como(rol, uid, () => C.intentar(`select * from public.take_link_notifications(5)`))).ok, `${rol} ${uid} take`).toBe(false)
      expect((await C.como(rol, uid, () => C.intentar(`select public.finish_link_notification(1, true, null)`))).ok, `${rol} ${uid} finish`).toBe(false)
      expect((await C.como(rol, uid, () => C.intentar(`select * from public.client_link_notifications`))).ok, `${rol} ${uid} tabla`).toBe(false)
    }
  }))
})

describe('4. Desvinculación completa: todas las tablas de datos del cliente, el almacenamiento, las sesiones existentes y lo que no se puede revocar', () => {
  const TODAS = ['anamnesis', 'weight_logs', 'diet_plans', 'push_subscriptions', ...TABLAS_NUEVAS]
  const sembrar = async () => {
    await db.exec(`insert into public.anamnesis (client_id, answers) values ('${FICHA_U}', '{}'); insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_U}', 70);
      insert into public.diet_plans (client_id, nutricionista_id, name, kcal_target) values ('${FICHA_U}', '${P}', 'Plan', 1900)`)
    for (const t of TABLAS_NUEVAS) await db.exec(`insert into public.${t} (client_id) values ('${FICHA_U}')`)
    await db.exec(`insert into public.push_subscriptions (client_id, endpoint, p256dh, auth) values ('${FICHA_U}', 'https://push.invalid/x', 'k', 'a')`)
    await db.exec(`insert into storage.objects (bucket_id, name) values ('photos', '${FICHA_U}/front.jpg'), ('lab-reports', '${FICHA_U}/a.pdf')`)
  }
  const lecturas = async (uid: string) => {
    const out: Record<string, number> = {}
    for (const t of TODAS) { const r = await C.como('authenticated', uid, () => C.intentar(`select count(*)::int n from public.${t} where client_id = '${FICHA_U}'`)); out[t] = r.ok ? Number(r.rows[0].n) : -1 }
    const o = await C.como('authenticated', uid, () => C.intentar(`select count(*)::int n from storage.objects where name like '${FICHA_U}/%'`)); out['storage.objects'] = o.ok ? Number(o.rows[0].n) : -1
    return out
  }
  it('ANTES: la titular lee y escribe todo; DESPUÉS de desvincular (misma sesión, mismo uid): 0 filas en las 19 tablas y en el almacenamiento, sin poder escribir, actualizar ni borrar nada', aislada(async () => {
    expect(await reclamar(UL, await invitar(P, FICHA_U))).toBe('linked')
    await sembrar()
    const antes = await lecturas(UL)
    for (const [t, n] of Object.entries(antes)) expect(n, 'antes ' + t).toBeGreaterThan(0)
    expect((await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', null, false`))).toMatchObject({ ok: true })
    const despues = await lecturas(UL)
    for (const [t, n] of Object.entries(despues)) expect(n, 'después ' + t).toBe(t === 'push_subscriptions' ? 0 : 0)
    // escritura, actualización y borrado: nada
    for (const t of ['anamnesis', 'weight_logs', ...LECTURA_ESCRITURA]) {
      const ins = await C.como('authenticated', UL, () => C.intentar(t === 'anamnesis' ? `insert into public.anamnesis (client_id, answers) values ('${FICHA_U}', '{}')` : t === 'weight_logs' ? `insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_U}', 1)` : `insert into public.${t} (client_id) values ('${FICHA_U}')`))
      expect(ins.ok, 'insert ' + t).toBe(false)
      const upd = await C.como('authenticated', UL, () => C.intentar(`update public.${t} set client_id = client_id where client_id = '${FICHA_U}' returning 1`)); expect(upd.ok ? upd.rows.length : 0, 'update ' + t).toBe(0)
      const del = await C.como('authenticated', UL, () => C.intentar(`delete from public.${t} where client_id = '${FICHA_U}' returning 1`)); expect(del.ok ? del.rows.length : 0, 'delete ' + t).toBe(0)
    }
    for (const orden of [`insert into storage.objects (bucket_id, name) values ('photos', '${FICHA_U}/nueva.jpg')`]) expect((await C.como('authenticated', UL, () => C.intentar(orden))).ok).toBe(false)
    const delObj = await C.como('authenticated', UL, () => C.intentar(`delete from storage.objects where name like '${FICHA_U}/%' returning 1`)); expect(delObj.ok ? delObj.rows.length : 0).toBe(0)
    // los datos NO se han borrado: siguen para el profesional
    expect(await C.cuenta('weight_logs', `client_id = '${FICHA_U}'`)).toBe(1) // los datos siguen ahí: desvincular no borra nada
    expect(await C.cuenta('anamnesis', `client_id = '${FICHA_U}'`)).toBe(1)
    const pro = await C.como('authenticated', P, () => C.intentar(`select count(*)::int n from public.anamnesis where client_id = '${FICHA_U}'`)); expect(pro.ok && pro.rows[0].n).toBe(1)
  }))
  it('PERMISOS RESIDUALES: sin acceso por funciones ni por RPC (token de la ficha, perfil, consentimiento, estado), con el token antiguo ni con una invitación vieja', aislada(async () => {
    const tokenAntes = String((await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token)
    const inv = await invitar(P, FICHA_U)
    await reclamar(UL, inv)
    await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', null, false`)
    expect((await C.como('authenticated', UL, () => C.intentar(`select public.get_my_client_token() as t`)))).toEqual({ ok: true, rows: [{ t: null }] })
    expect((await C.filas(`select token from public.clientes where id = '${FICHA_U}'`))[0].token).not.toBe(tokenAntes)
    expect(await C.como('authenticated', UL, () => C.intentar(`select claimed, is_mine from public.get_client_link_state('${tokenAntes}')`))).toEqual({ ok: true, rows: [] }) // el token anterior ya no existe
    await C.como('authenticated', UL, () => C.intentar(`select public.accept_consent('${tokenAntes}', 'Intento')`))
    expect((await consentimiento(FICHA_U)).nombre).toBeNull()
    expect(await reclamar(UL, inv)).toBe('invitation_used') // la invitación consumida no sirve para volver
    const isOwner = await C.como('authenticated', UL, () => C.intentar(`select private.is_owner_client('${FICHA_U}') o`)); expect(isOwner.ok && isOwner.rows[0].o).toBe(false)
    // el resto de la titularidad de la misma cuenta (otra ficha suya) no se ve afectado
    expect(await dueno(FICHA_C)).toBe(UC)
  }))
  it('CONTROL: la titular de OTRA ficha mantiene su acceso intacto mientras se desvincula la de al lado', aislada(async () => {
    await reclamar(UL, await invitar(P, FICHA_U))
    await db.exec(`insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_C}', 61.5)`)
    await llamar('authenticated', P, 'unlink_client_account', `'${FICHA_U}', null, false`)
    const c = await C.como('authenticated', UC, () => C.intentar(`select count(*)::int n from public.weight_logs where client_id = '${FICHA_C}'`)); expect(c.ok && c.rows[0].n).toBe(1)
  }))
})
