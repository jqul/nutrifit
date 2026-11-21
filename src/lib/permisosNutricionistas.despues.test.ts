import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { P, Q, UC, UD, UN, ADM, PER, FICHA_C, FICHA_D, PLAN_C, PLAN_D, ESQUEMA, entorno } from './permisosHarness'

// DESPUÉS DE LA CORRECCIÓN (H-B1, H-B2): la réplica de producción + la migración 0074 (la etapa 2, 0075, tiene su propio fichero y no forma parte de este PR), en
// PostgreSQL REAL (PGlite). Las aserciones «DESEADO» de permisosNutricionistas.antes.test.ts (que allí fallan a propósito) pasan aquí
// como pruebas normales.
//
// QUÉ DEMUESTRA: que, en esa réplica y actuando como los roles `anon` / `authenticated` con el `sub` de un JWT, ya no se puede escalar el
// rol ni autoaprobarse ni borrar una cuenta de profesional; que lo legítimo sigue funcionando; y que las barreras no dependen de datos
// que el cliente pueda manipular (rol de la base, parámetros de sesión, reclamaciones del JWT).
// QUÉ NO DEMUESTRA (queda para Supabase real): PostgREST ni los JWT reales (aquí `sub` se fija a mano: la autenticidad del JWT es
// responsabilidad de Supabase Auth y de PostgREST), el registro
// público, ni que producción siga igual que la réplica leída el 2026-11-20.
const sql = import.meta.glob('../../supabase/migrations/0074_*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const migracion = (n: string) => {
  const clave = Object.keys(sql).find(k => k.includes(`/${n}_`))
  if (!clave) throw new Error(`falta la migración ${n}`)
  return sql[clave]
}

let db1: PGlite // réplica + 0074
beforeAll(async () => {
  db1 = new PGlite(); await db1.exec(ESQUEMA); await db1.exec(migracion('0074'))
}, 90_000)
afterAll(async () => { await db1.close() })
const { aislada, como, intentar, filas, cuenta } = entorno(() => db1)

/** Un superadministrador legítimo, creado como lo haría el propietario de la base (no hay otra vía). */
const conSuperadmin = (db: () => PGlite) => async () => {
  await db().exec(`insert into auth.users (id, email) values ('${ADM}', 'adm@prueba.invalid');
    insert into public.nutricionistas (uid, email, display_name, approved, role) values ('${ADM}', 'adm@prueba.invalid', 'Admin', true, 'super_admin')`)
}
/** Una cuenta en modo personal creada por el registro real (trigger de auth.users): aprobada y con su ficha propia. */
const conPersonal = async (db: PGlite) => {
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${PER}', 'per@prueba.invalid', '{"signup_type":"nutricionista","account_mode":"personal"}')`)
  return String((await db.query<{ id: string }>(`select id from public.clientes where nutricionista_id = '${PER}'`)).rows[0].id)
}
const denegado = (r: { ok: boolean; error?: string }) => r.ok === false && /permission denied|42501|No se pueden|Solo un superadmin|no se pueden borrar|row-level security|Sin acceso/i.test(r.error ?? '')

describe('Controles: lo que ya protegía el esquema y debe seguir igual', () => {
  it('un profesional no ve las fichas, los planes ni la anamnesis de otro profesional', aislada(async () => {
    const r = await como('authenticated', P, async () => ({
      fichasQ: await intentar(`select id from public.clientes where nutricionista_id = '${Q}'`),
      planesQ: await intentar(`select id from public.diet_plans where id = '${PLAN_D}'`),
      anamnesisQ: await intentar(`select id from public.anamnesis where client_id = '${FICHA_D}'`),
      filaQ: await intentar(`select uid from public.nutricionistas where uid = '${Q}'`),
    }))
    for (const v of Object.values(r)) expect(v.ok && v.rows.length).toBe(0)
  }))
  it('el rol anónimo no lee ni modifica nutricionistas', aislada(async () => {
    expect(await como('anon', null, () => intentar(`select uid from public.nutricionistas`))).toEqual({ ok: true, rows: [] })
    expect(denegado(await como('anon', null, () => intentar(`update public.nutricionistas set accent_color = 'x' where uid = '${P}'`)))).toBe(true)
  }))
  it('una clienta de otro profesional no puede modificar ni borrar a P', aislada(async () => {
    const upd = await como('authenticated', UD, () => intentar(`update public.nutricionistas set accent_color = '#000' where uid = '${P}' returning uid`))
    expect(upd.ok && upd.rows.length).toBe(0)
    expect(denegado(await como('authenticated', UD, () => intentar(`delete from public.nutricionistas where uid = '${P}'`)))).toBe(true)
    expect(await cuenta('nutricionistas', `uid = '${P}'`)).toBe(1)
  }))
})

describe('H-B1 cerrado: nadie escala su rol, se autoaprueba ni cambia su identidad', () => {
  it('DESEADO (pasa a normal): un profesional no puede cambiar su propio role ni approved', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin', approved = true where uid = '${P}'`))
    expect(denegado(r)).toBe(true)
    expect(await filas(`select role, approved from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'trainer', approved: false }])
  }))
  it('cada columna protegida se rechaza por separado, también con el mismo valor que ya tiene, y la fila no cambia', aislada(async () => {
    const antes = await filas(`select uid, email, role, approved, account_mode, created_at, display_name from public.nutricionistas where uid = '${P}'`)
    for (const set of [`role = 'super_admin'`, `approved = true`, `account_mode = 'personal'`, `email = 'otro@prueba.invalid'`, `created_at = now() - interval '1 year'`,
      `uid = '${UN}'`, `display_name = 'Otro nombre'`, `role = 'trainer'`]) {
      const r = await como('authenticated', P, () => intentar(`update public.nutricionistas set ${set} where uid = '${P}'`))
      expect(denegado(r), set).toBe(true)
    }
    expect(await filas(`select uid, email, role, approved, account_mode, created_at, display_name from public.nutricionistas where uid = '${P}'`)).toEqual(antes)
  }))
  it('DESEADO (pasa a normal): tras intentar ascender, P sigue sin acceder a los datos de otro profesional', aislada(async () => {
    await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}'`))
    const r = await como('authenticated', P, () => intentar(`select id from public.clientes where nutricionista_id = '${Q}'`))
    expect(r.ok && r.rows.length).toBe(0)
  }))
  it('la variante por INSERT queda cerrada: ningún usuario con sesión crea una fila de profesional (ni con ON CONFLICT DO UPDATE)', aislada(async () => {
    const ins = await como('authenticated', UN, () => intentar(`insert into public.nutricionistas (uid, email, role, approved) values ('${UN}', 'n@prueba.invalid', 'super_admin', true)`))
    expect(denegado(ins)).toBe(true)
    const ups = await como('authenticated', P, () => intentar(
      `insert into public.nutricionistas (uid, email, role, approved) values ('${P}', 'p@prueba.invalid', 'super_admin', true) on conflict (uid) do update set role = 'super_admin', approved = true`))
    expect(denegado(ups)).toBe(true)
    expect(await cuenta('nutricionistas', `uid = '${UN}'`)).toBe(0)
    expect(await filas(`select role, approved from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'trainer', approved: false }])
  }))
  it('una clienta vinculada tampoco puede ascender, aprobar ni modificar la fila de su profesional', aislada(async () => {
    for (const set of [`role = 'super_admin'`, `approved = true`, `accent_color = '#000'`]) {
      const r = await como('authenticated', UC, () => intentar(`update public.nutricionistas set ${set} where uid = '${P}' returning uid`))
      expect(r.ok ? r.rows.length : 0, set).toBe(0)
    }
    expect(await filas(`select role, approved, accent_color from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'trainer', approved: false, accent_color: null }])
  }))
  it('un UPDATE sin filtro solo alcanza la fila propia', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`update public.nutricionistas set accent_color = '#abcdef' returning uid`))
    expect(r).toEqual({ ok: true, rows: [{ uid: P }] })
    expect(await cuenta('nutricionistas', `uid = '${Q}' and accent_color is not null`)).toBe(0)
  }))
})

describe('H-B2 cerrado: nadie borra una cuenta de profesional desde la API', () => {
  it('DESEADO (pasa a normal): una clienta vinculada no puede borrar la fila de su profesional, y no se borra nada en cascada', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`delete from public.nutricionistas where uid = '${P}' returning uid`))
    expect(denegado(r)).toBe(true)
    expect([await cuenta('nutricionistas', `uid = '${P}'`), await cuenta('clientes', `nutricionista_id = '${P}'`), await cuenta('diet_plans', `nutricionista_id = '${P}'`),
      await cuenta('diet_plan_versions', `plan_id = '${PLAN_C}'`), await cuenta('diet_plan_changes', `plan_id = '${PLAN_C}'`)]).toEqual([1, 2, 1, 1, 1])
  }))
  it('tampoco el propio profesional, ni un superadministrador, ni el rol anónimo (decisión: el borrado de cuenta no es una operación de la API)', aislada(async () => {
    await conSuperadmin(() => db1)()
    expect(denegado(await como('authenticated', P, () => intentar(`delete from public.nutricionistas where uid = '${P}'`)))).toBe(true)
    expect(denegado(await como('authenticated', ADM, () => intentar(`delete from public.nutricionistas where uid = '${P}'`)))).toBe(true)
    expect(denegado(await como('anon', null, () => intentar(`delete from public.nutricionistas where uid = '${P}'`)))).toBe(true)
    expect(await cuenta('nutricionistas', `uid = '${P}'`)).toBe(1)
  }))
  it('TRUNCATE rechazado para los roles de la API', aislada(async () => {
    expect(denegado(await como('authenticated', UC, () => intentar(`truncate public.nutricionistas cascade`)))).toBe(true)
    expect(denegado(await como('anon', null, () => intentar(`truncate public.nutricionistas cascade`)))).toBe(true)
    expect(await cuenta('nutricionistas')).toBe(2)
  }))
})

describe('Las barreras son independientes: cada capa basta por sí sola (si se re-concediera un privilegio, el trigger sigue frenando)', () => {
  const regalo = `grant update, delete, truncate, insert on public.nutricionistas to authenticated;
    create policy prueba_permisiva on public.nutricionistas for all to authenticated using (true) with check (true);`
  it('con TODOS los privilegios y una política permisiva, el trigger sigue frenando cambios de role/approved/uid/account_mode/email/created_at', aislada(async () => {
    await db1.exec(regalo)
    for (const set of [`role = 'super_admin'`, `approved = true`, `account_mode = 'personal'`, `email = 'x@x.invalid'`, `created_at = now() - interval '2 year'`]) {
      const r = await como('authenticated', P, () => intentar(`update public.nutricionistas set ${set} where uid = '${P}'`))
      expect(r.ok === false && /No se pueden modificar|Solo un superadmin/.test(r.error), set).toBe(true)
    }
  }))
  it('con TODOS los privilegios y una política permisiva, el trigger sigue frenando el borrado y el TRUNCATE', aislada(async () => {
    await db1.exec(regalo)
    const del = await como('authenticated', UC, () => intentar(`delete from public.nutricionistas where uid = '${P}'`))
    expect(del.ok === false && /no se pueden borrar/.test(del.error)).toBe(true)
    const tr = await como('authenticated', UC, () => intentar(`truncate public.nutricionistas cascade`))
    expect(tr.ok === false && /no se pueden borrar|permission denied/.test(tr.error)).toBe(true)
    expect(await cuenta('nutricionistas', `uid = '${P}'`)).toBe(1)
  }))
  it('con la política permisiva pero SIN el privilegio de columna, el privilegio frena (capa 1 sola)', aislada(async () => {
    await db1.exec(`create policy prueba_permisiva on public.nutricionistas for all to authenticated using (true) with check (true)`)
    expect(denegado(await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}'`)))).toBe(true)
  }))
  it('el trigger no se salta con session_replication_role = replica (ENABLE ALWAYS)', aislada(async () => {
    await db1.exec(regalo + `set local session_replication_role = replica`)
    const upd = await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}'`))
    expect(upd.ok === false && /No se pueden modificar/.test(upd.error)).toBe(true)
    const del = await como('authenticated', UC, () => intentar(`delete from public.nutricionistas where uid = '${P}'`))
    expect(del.ok === false && /no se pueden borrar/.test(del.error)).toBe(true)
  }))
})

describe('Aprobación por superadministrador y trabajo legítimo del propio profesional', () => {
  it('un superadministrador aprueba y retira la aprobación de un profesional; el profesional no puede hacerlo ni sobre sí mismo ni sobre otro', aislada(async () => {
    await conSuperadmin(() => db1)()
    expect(await como('authenticated', ADM, () => intentar(`update public.nutricionistas set approved = true where uid = '${P}' returning approved`))).toEqual({ ok: true, rows: [{ approved: true }] })
    expect(await como('authenticated', ADM, () => intentar(`update public.nutricionistas set approved = false where uid = '${P}' returning approved`))).toEqual({ ok: true, rows: [{ approved: false }] })
    expect(denegado(await como('authenticated', P, () => intentar(`update public.nutricionistas set approved = true where uid = '${P}'`)))).toBe(true)
    const aOtro = await como('authenticated', P, () => intentar(`update public.nutricionistas set approved = true where uid = '${Q}' returning uid`))
    expect(aOtro.ok ? aOtro.rows.length : 0).toBe(0)
  }))
  it('el superadministrador lee todas las cuentas (el panel de administración), pero tampoco por la API cambia role, account_mode, email ni uid de nadie', aislada(async () => {
    await conSuperadmin(() => db1)()
    const lee = await como('authenticated', ADM, () => intentar(`select uid from public.nutricionistas`))
    expect(lee.ok && lee.rows.length).toBe(3)
    for (const set of [`role = 'super_admin'`, `account_mode = 'personal'`, `email = 'x@x.invalid'`]) {
      expect(denegado(await como('authenticated', ADM, () => intentar(`update public.nutricionistas set ${set} where uid = '${P}'`))), set).toBe(true)
    }
    expect(await filas(`select role, account_mode, email from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'trainer', account_mode: 'professional', email: 'p@prueba.invalid' }])
  }))
  it('USO LEGÍTIMO: el profesional guarda marca, preguntas de anamnesis y documento de consentimiento (las 7 columnas que escribe Ajustes)', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(
      `update public.nutricionistas set logo_url = 'https://x/l.png', accent_color = '#123456', custom_domain = 'p.example.invalid', contact_phone = '600', app_name = 'Mi app',
         consent_document_url = 'ruta/doc.pdf', custom_anamnesis_questions = '[{"id":"q9","label":"¿Nueva?"}]'::jsonb where uid = '${P}' returning uid`))
    expect(r).toEqual({ ok: true, rows: [{ uid: P }] })
    expect(await filas(`select app_name, custom_anamnesis_questions from public.nutricionistas where uid = '${P}'`)).toEqual([{ app_name: 'Mi app', custom_anamnesis_questions: [{ id: 'q9', label: '¿Nueva?' }] }])
  }))
  it('USO LEGÍTIMO: un dominio propio duplicado sigue dando el error de unicidad que Ajustes traduce a «Ese dominio ya está en uso»', aislada(async () => {
    await db1.exec(`update public.nutricionistas set custom_domain = 'ocupado.example.invalid' where uid = '${Q}'`)
    const r = await como('authenticated', P, () => intentar(`update public.nutricionistas set custom_domain = 'ocupado.example.invalid' where uid = '${P}'`))
    expect(r.ok === false && /duplicate/.test(r.error)).toBe(true)
  }))
  it('USO LEGÍTIMO: el profesional lee su propia fila completa (arranque de la sesión)', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`select display_name, approved, role, custom_anamnesis_questions, logo_url, accent_color, custom_domain, contact_phone, app_name, consent_document_url, account_mode from public.nutricionistas where uid = '${P}'`))
    expect(r.ok && r.rows.length).toBe(1)
  }))
  it('display_name NO es editable por la API (decisión: la aplicación no lo necesita)', aislada(async () => {
    expect(denegado(await como('authenticated', P, () => intentar(`update public.nutricionistas set display_name = 'Otro' where uid = '${P}'`)))).toBe(true)
  }))
})

describe('Registro y cascadas legítimas (lo que corre como propietario de la base o como service_role)', () => {
  it('el registro como profesional crea la fila sin aprobar; el de modo personal, aprobada y con su ficha propia (trigger SECURITY DEFINER, como supabase_auth_admin)', aislada(async () => {
    const NUEVO = '00000000-0000-4000-8000-0000000000ac'
    await db1.exec(`set role supabase_auth_admin`)
    await db1.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${NUEVO}', 'nuevo@prueba.invalid', '{"signup_type":"nutricionista"}'),
      ('${PER}', 'per@prueba.invalid', '{"signup_type":"nutricionista","account_mode":"personal"}')`)
    await db1.exec(`reset role`)
    expect(await filas(`select uid, approved, role, account_mode from public.nutricionistas where uid in ('${NUEVO}','${PER}') order by uid`)).toEqual([
      { uid: NUEVO, approved: false, role: 'trainer', account_mode: 'professional' }, { uid: PER, approved: true, role: 'trainer', account_mode: 'personal' }])
    expect(await cuenta('clientes', `nutricionista_id = '${PER}' and auth_user_id = '${PER}'`)).toBe(1)
  }))
  it('borrar la cuenta de autenticación (como lo hace Supabase Auth, con el propietario) sigue arrastrando en cascada todo lo del profesional', aislada(async () => {
    await db1.exec(`delete from auth.users where id = '${P}'`)
    expect([await cuenta('nutricionistas', `uid = '${P}'`), await cuenta('clientes', `nutricionista_id = '${P}'`), await cuenta('diet_plans', `nutricionista_id = '${P}'`),
      await cuenta('diet_plan_versions', `plan_id = '${PLAN_C}'`), await cuenta('diet_plan_changes', `plan_id = '${PLAN_C}'`)]).toEqual([0, 0, 0, 0, 0])
    expect(await cuenta('nutricionistas', `uid = '${Q}'`)).toBe(1)
  }))
  it('el propietario de la base y service_role (funciones de borde, mantenimiento) siguen pudiendo modificar y borrar', aislada(async () => {
    await db1.exec(`update public.nutricionistas set role = 'super_admin', approved = true where uid = '${P}'`)
    expect(await filas(`select role, approved from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'super_admin', approved: true }])
    const upd = await como('service_role', null, () => intentar(`update public.nutricionistas set approved = false where uid = '${P}' returning approved`))
    expect(upd).toEqual({ ok: true, rows: [{ approved: false }] })
    const del = await como('service_role', null, () => intentar(`delete from public.nutricionistas where uid = '${Q}' returning uid`))
    expect(del).toEqual({ ok: true, rows: [{ uid: Q }] })
  }))
  it('una función SECURITY DEFINER del propietario puede escribir en la tabla aunque la llame un usuario de la API (la barrera mira el rol efectivo, no quién la llamó)', aislada(async () => {
    await db1.exec(`create function public.prueba_admin_aprueba(p uuid) returns void language sql security definer set search_path = public as $$ update public.nutricionistas set approved = true where uid = p $$;
      grant execute on function public.prueba_admin_aprueba(uuid) to authenticated`)
    await como('authenticated', P, () => intentar(`select public.prueba_admin_aprueba('${P}')`))
    expect(await filas(`select approved from public.nutricionistas where uid = '${P}'`)).toEqual([{ approved: true }])
  }))
  it('borrar una ficha sigue arrastrando su anamnesis, planes e historial (cascada legítima, no tocada)', aislada(async () => {
    await db1.exec(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{}')`)
    const r = await como('authenticated', P, () => intentar(`delete from public.clientes where id = '${FICHA_C}' returning id`))
    expect(r.ok && r.rows.length).toBe(1)
    expect([await cuenta('anamnesis', `client_id = '${FICHA_C}'`), await cuenta('diet_plans', `client_id = '${FICHA_C}'`), await cuenta('diet_plan_changes', `client_id = '${FICHA_C}'`)]).toEqual([0, 0, 0])
  }))
})

describe('Cuenta en modo personal (aprobación automática): aislada de terceros y sin poder adquirir permisos profesionales', () => {
  it('no puede cambiar role, approved, account_mode, email ni uid; no puede insertar otra fila de profesional ni borrar la suya', aislada(async () => {
    await conPersonal(db1)
    for (const set of [`role = 'super_admin'`, `account_mode = 'professional'`, `email = 'x@x.invalid'`, `uid = '${UN}'`, `approved = false`]) {
      expect(denegado(await como('authenticated', PER, () => intentar(`update public.nutricionistas set ${set} where uid = '${PER}'`))), set).toBe(true)
    }
    expect(denegado(await como('authenticated', PER, () => intentar(`insert into public.nutricionistas (uid, email) values ('${UN}', 'x@x.invalid')`)))).toBe(true)
    expect(denegado(await como('authenticated', PER, () => intentar(`delete from public.nutricionistas where uid = '${PER}'`)))).toBe(true)
    expect(await filas(`select role, approved, account_mode from public.nutricionistas where uid = '${PER}'`)).toEqual([{ role: 'trainer', approved: true, account_mode: 'personal' }])
  }))
  it('solo ve lo suyo: ninguna fila de profesional, ficha, plan ni anamnesis de terceros; no modifica ni lee a otros', aislada(async () => {
    const ficha = await conPersonal(db1)
    const r = await como('authenticated', PER, async () => ({
      nutri: await intentar(`select uid from public.nutricionistas`),
      fichas: await intentar(`select id from public.clientes`),
      planes: await intentar(`select id from public.diet_plans`),
      anam: await intentar(`select id from public.anamnesis`),
      aOtro: await intentar(`update public.nutricionistas set accent_color = '#000' where uid = '${P}' returning uid`),
      fichaAjena: await intentar(`update public.clientes set name = 'x' where id = '${FICHA_C}' returning id`),
      preguntasAjenas: await intentar(`select public.get_custom_anamnesis_questions('${P}')`),
    }))
    expect(r.nutri).toEqual({ ok: true, rows: [{ uid: PER }] })
    expect(r.fichas).toEqual({ ok: true, rows: [{ id: ficha }] })
    expect(r.planes).toEqual({ ok: true, rows: [] })
    expect(r.anam).toEqual({ ok: true, rows: [] })
    expect(r.aOtro.ok ? r.aOtro.rows.length : 0).toBe(0)
    expect(r.fichaAjena.ok ? r.fichaAjena.rows.length : 0).toBe(0)
    expect(denegado(r.preguntasAjenas)).toBe(true)
  }))
  it('no puede asignarse a sí misma la ficha de un tercero ni mover su ficha a otro profesional (WITH CHECK de clientes)', aislada(async () => {
    const ficha = await conPersonal(db1)
    const r = await como('authenticated', PER, () => intentar(`update public.clientes set nutricionista_id = '${P}' where id = '${ficha}' returning id`))
    expect(r.ok === false).toBe(true)
    expect(await cuenta('clientes', `id = '${ficha}' and nutricionista_id = '${PER}'`)).toBe(1)
  }))
  it('LÍMITE CONOCIDO (no se corrige aquí): la cuenta personal puede crear fichas adicionales propias, es decir, ninguna regla técnica la limita a UNA ficha', aislada(async () => {
    await conPersonal(db1)
    const r = await como('authenticated', PER, () => intentar(`insert into public.clientes (nutricionista_id, token, name) values ('${PER}', 'tokExtra', 'Otra persona') returning id`))
    expect(r.ok && r.rows.length).toBe(1)
  }))
})

describe('El contexto de sesión no sirve para eludir la protección', () => {
  const regalo = `grant update on public.nutricionistas to authenticated; create policy prueba_permisiva on public.nutricionistas for all to authenticated using (true) with check (true);`
  // LÍMITE DE ESTA PRUEBA: en Supabase el usuario de conexión (authenticator) es miembro de anon, authenticated y service_role, así que quien
  // pudiera ejecutar SQL libre con esa conexión podría hacer `SET ROLE service_role` (y saltarse RLS y la lista de permitidos del trigger).
  // Ninguna política ni trigger lo puede impedir: se sostiene en que PostgREST no deja ejecutar SQL libre ni SET ROLE a un cliente.
  it('SET ROLE hacia el propietario de la base está prohibido para un usuario de la API (la conexión no es superusuario)', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`set role postgres`))
    expect(r.ok === false && /permission denied/.test(r.error)).toBe(true)
    const c = await como('authenticated', P, () => intentar(`select set_config('role', 'postgres', true)`))
    expect(c.ok === false && /permission denied/.test(c.error)).toBe(true)
  }))
  it('session_replication_role (que desactivaría los triggers normales) no está al alcance de un usuario de la API', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`set session_replication_role = replica`))
    expect(r.ok === false && /permission denied/.test(r.error)).toBe(true)
  }))
  it('falsear reclamaciones del JWT («role»: service_role) o parámetros personalizados no cambia nada: la barrera mira el rol de la base', aislada(async () => {
    await db1.exec(regalo) // con los privilegios abiertos, lo único que queda es el trigger
    const r = await como('authenticated', P, async () => {
      await db1.exec(`select set_config('request.jwt.claims', '{"role":"service_role","sub":"${P}"}', true),
        set_config('request.jwt.claim.role', 'service_role', true), set_config('app.bypass', 'true', true),
        set_config('app.es_admin', 'true', true)`)
      return intentar(`update public.nutricionistas set role = 'super_admin', approved = true where uid = '${P}'`)
    })
    expect(r.ok === false && /No se pueden modificar/.test(r.error)).toBe(true)
  }))
  it('un usuario de la API no puede crear funciones ni triggers para interponerse (sin CREATE en el esquema, sin TRIGGER en la tabla)', aislada(async () => {
    const f = await como('authenticated', P, () => intentar(`create function public.f() returns trigger language plpgsql as $$ begin return new; end $$`))
    expect(f.ok === false && /permission denied/.test(f.error)).toBe(true)
    const t = await como('authenticated', P, () => intentar(`create trigger x before update on public.nutricionistas for each row execute function private.nutricionistas_proteger_update()`))
    expect(t.ok).toBe(false)
    const dt = await como('authenticated', P, () => intentar(`alter table public.nutricionistas disable trigger nutricionistas_proteger_update`))
    expect(dt.ok).toBe(false)
  }))
  it('las funciones trigger no son invocables por los roles de la API', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`select private.nutricionistas_proteger_update()`))
    expect(r.ok).toBe(false)
  }))
  it('una tabla temporal con el mismo nombre no convierte a P en superadministrador (is_super_admin con search_path fijo)', aislada(async () => {
    const r = await como('authenticated', P, async () => {
      await intentar(`create temp table nutricionistas (uid uuid, role text)`)
      await intentar(`insert into pg_temp.nutricionistas values ('${P}', 'super_admin')`)
      return intentar(`select private.is_super_admin() as es`)
    })
    expect(r).toEqual({ ok: true, rows: [{ es: false }] })
  }))
})

describe('RPC get_custom_anamnesis_questions: solo la columna de preguntas, con error visible si no hay acceso', () => {
  const preguntas = (uid: string | null, rol = 'authenticated', objetivo = P) =>
    como(rol, uid, () => intentar(`select public.get_custom_anamnesis_questions('${objetivo}') as q`))
  it('devuelve SOLO la lista de preguntas (jsonb) al profesional, a su clienta vinculada y a un superadministrador', aislada(async () => {
    await conSuperadmin(() => db1)()
    const esperado = { ok: true, rows: [{ q: [{ id: 'q1', label: '¿Pregunta de P?' }] }] }
    expect(await preguntas(P)).toEqual(esperado)
    expect(await preguntas(UC)).toEqual(esperado)
    expect(await preguntas(ADM)).toEqual(esperado)
  }))
  it('falla con error (nunca una lista vacía) para la clienta de otro profesional, un usuario sin vínculo y quien no tiene sesión', aislada(async () => {
    expect(denegado(await preguntas(UD))).toBe(true)
    expect(denegado(await preguntas(UN))).toBe(true)
    const sinSesion = await preguntas(null)
    expect(sinSesion.ok === false && /sesión|28000/.test(sinSesion.error)).toBe(true)
  }))
  it('el rol anónimo no puede ejecutarla', aislada(async () => {
    expect(denegado(await preguntas(null, 'anon'))).toBe(true)
  }))
  it('un profesional sin preguntas recibe [] (lista vacía legítima, distinta de un error)', aislada(async () => {
    expect(await preguntas(Q, 'authenticated', Q)).toEqual({ ok: true, rows: [{ q: [] }] })
  }))
})

describe('Borrado legítimo desde Supabase Auth: qué rol ve el trigger durante la cascada', () => {
  // En producción (leído el 2026-11-20, solo lectura): auth.users es de supabase_auth_admin; public.nutricionistas es de postgres; la clave foránea
  // nutricionistas_uid_fkey es ON DELETE CASCADE. Postgres ejecuta la acción referencial con los privilegios del propietario de la tabla
  // que se modifica (aquí nutricionistas = postgres), no con los de quien borra el usuario. La réplica reproduce esos propietarios.
  it('al borrar un usuario como supabase_auth_admin, los triggers de nutricionistas ven current_user = postgres y la cascada completa pasa', aislada(async () => {
    await db1.exec(`create table public.sonda (usuario text, operacion text);
      create function public.sonda_fn() returns trigger language plpgsql as $$ begin insert into public.sonda values (current_user, tg_op); return old; end $$;
      create trigger aa_sonda before delete on public.nutricionistas for each row execute function public.sonda_fn();`)
    await db1.exec(`set local session authorization supabase_auth_admin`)
    try { await db1.exec(`delete from auth.users where id = '${P}'`) } finally { await db1.exec(`set local session authorization postgres`) }
    expect(await filas(`select usuario, operacion from public.sonda`)).toEqual([{ usuario: 'postgres', operacion: 'DELETE' }])
    expect([await cuenta('nutricionistas', `uid = '${P}'`), await cuenta('clientes', `nutricionista_id = '${P}'`), await cuenta('diet_plans', `nutricionista_id = '${P}'`),
      await cuenta('diet_plan_versions', `plan_id = '${PLAN_C}'`), await cuenta('diet_plan_changes', `plan_id = '${PLAN_C}'`)]).toEqual([0, 0, 0, 0, 0])
    expect(await cuenta('nutricionistas', `uid = '${Q}'`)).toBe(1)
  }))
  it('borrar el usuario de una CLIENTA solo desvincula su ficha (SET NULL), sin tocar nutricionistas', aislada(async () => {
    await db1.exec(`set local session authorization supabase_auth_admin`)
    try { await db1.exec(`delete from auth.users where id = '${UC}'`) } finally { await db1.exec(`set local session authorization postgres`) }
    expect(await filas(`select auth_user_id from public.clientes where id = '${FICHA_C}'`)).toEqual([{ auth_user_id: null }])
    expect(await cuenta('nutricionistas', `uid = '${P}'`)).toBe(1)
  }))
  it('los roles de la API, en cambio, no pueden borrar usuarios de autenticación (y por tanto tampoco provocar esa cascada)', aislada(async () => {
    expect((await como('authenticated', P, () => intentar(`delete from auth.users where id = '${P}'`))).ok).toBe(false)
  }))
})

describe('RPC get_custom_anamnesis_questions: privilegios efectivos, search_path y SECURITY DEFINER', () => {
  // Producción (solo lectura): ALTER DEFAULT PRIVILEGES de postgres en public concede EXECUTE sobre funciones nuevas a anon, authenticated y
  // service_role, y las funciones ya existentes llevan además `=X` (PUBLIC). La réplica lo reproduce, así que lo que se comprueba aquí es
  // que la migración QUITA lo que esos privilegios por defecto darían.
  const acl = async (nombre: string) => String((await filas(`select coalesce(proacl::text, 'default') acl from pg_proc where proname = '${nombre}'`))[0]?.acl)
  const puede = async (rol: string, firma: string) => (await filas(`select has_function_privilege('${rol}', '${firma}', 'execute') p`))[0].p as boolean

  it('CONTROL: sin la migración, una función nueva de postgres en public SÍ sería ejecutable por anon y por PUBLIC (los privilegios por defecto están reproducidos)', aislada(async () => {
    await db1.exec(`create function public.control_acl() returns int language sql as $$ select 1 $$`)
    expect(await puede('anon', 'public.control_acl()')).toBe(true)
    expect(await acl('control_acl')).toMatch(/anon=X/)
  }))
  it('la RPC solo es ejecutable por authenticated (y los roles internos): no por anon ni por PUBLIC', aislada(async () => {
    const firma = 'public.get_custom_anamnesis_questions(uuid)'
    expect(await puede('anon', firma)).toBe(false)
    expect(await puede('authenticated', firma)).toBe(true)
    expect(await puede('service_role', firma)).toBe(true)
    const a = await acl('get_custom_anamnesis_questions')
    expect(a).not.toMatch(/(^|[{,])=X/)
    expect(a).not.toMatch(/anon=/)
  }))
  it('las funciones trigger de la migración no son ejecutables por anon, authenticated ni PUBLIC', aislada(async () => {
    for (const f of ['private.nutricionistas_proteger_update()', 'private.nutricionistas_proteger_borrado()']) {
      expect(await puede('anon', f), f).toBe(false)
      expect(await puede('authenticated', f), f).toBe(false)
    }
    expect(await acl('nutricionistas_proteger_update')).not.toMatch(/(^|[{,])=X/)
  }))
  it('es SECURITY DEFINER, STABLE, con search_path vacío, propiedad de postgres, devuelve solo jsonb y no tiene sobrecargas', aislada(async () => {
    const f = await filas(`select prosecdef, provolatile, array_to_string(proconfig, ',') cfg, pg_get_userbyid(proowner) dueno, pg_get_function_result(oid) devuelve, pronargs
      from pg_proc where proname = 'get_custom_anamnesis_questions'`)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ prosecdef: true, provolatile: 's', dueno: 'postgres', devuelve: 'jsonb', pronargs: 1 })
    expect(String(f[0].cfg)).toMatch(/search_path=""/)
  }))
  it('su código solo toca la columna custom_anamnesis_questions de nutricionistas: sin SQL dinámico, sin SELECT *, sin otras columnas', aislada(async () => {
    const src = String((await filas(`select prosrc from pg_proc where proname = 'get_custom_anamnesis_questions'`))[0].prosrc)
    expect(src).not.toMatch(/\bexecute\b/i)
    expect(src).not.toMatch(/select\s+\*/i)
    expect(src.match(/public\.\w+/g)).toEqual(['public.nutricionistas'])
    expect(src).toMatch(/select n\.custom_anamnesis_questions into v/)
    for (const columna of ['email', 'role', 'approved', 'account_mode', 'display_name', 'created_at']) expect(src, columna).not.toMatch(new RegExp(`\\b${columna}\\b`))
  }))
  it('no filtra nada más: el resultado para el profesional y su clienta es exactamente la lista de preguntas, aunque la fila tenga datos sensibles', aislada(async () => {
    await db1.exec(`update public.nutricionistas set app_name = 'secreto', contact_phone = '600000000', consent_document_url = 'ruta/privada.pdf' where uid = '${P}'`)
    for (const uid of [P, UC]) {
      const r = await como('authenticated', uid, () => intentar(`select public.get_custom_anamnesis_questions('${P}') as q`))
      expect(r).toEqual({ ok: true, rows: [{ q: [{ id: 'q1', label: '¿Pregunta de P?' }] }] })
      expect(JSON.stringify(r)).not.toMatch(/secreto|600000000|privada|p@prueba/)
    }
  }))
  it('no sirve para sondear: otra clienta, un usuario sin vínculo y un profesional ajeno reciben el MISMO error, sin datos', aislada(async () => {
    const msgs = new Set<string>()
    for (const uid of [UD, UN, Q]) {
      const r = await como('authenticated', uid, () => intentar(`select public.get_custom_anamnesis_questions('${P}')`))
      expect(r.ok).toBe(false)
      if (!r.ok) msgs.add(r.error)
    }
    expect(msgs.size).toBe(1)
  }))
  it('el search_path de la sesión no la altera: con pg_temp primero y una tabla temporal nutricionistas falsa, devuelve lo de la tabla real', aislada(async () => {
    const r = await como('authenticated', P, async () => {
      await intentar(`create temp table nutricionistas (uid uuid, custom_anamnesis_questions jsonb)`)
      await intentar(`insert into pg_temp.nutricionistas values ('${P}', '[{"id":"falsa"}]')`)
      await intentar(`set search_path = pg_temp, public`)
      return intentar(`select public.get_custom_anamnesis_questions('${P}') as q`)
    })
    expect(r).toEqual({ ok: true, rows: [{ q: [{ id: 'q1', label: '¿Pregunta de P?' }] }] })
  }))
})

// Los identificadores se usan todos arriba; esto evita avisos de importación sin uso si se retira alguna prueba.
void [FICHA_D, PLAN_C, PLAN_D, UN]
