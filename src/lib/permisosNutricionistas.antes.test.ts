import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { P, Q, UC, UD, UN, FICHA_C, FICHA_U, FICHA_D, PLAN_C, PLAN_D, ESQUEMA, entorno } from './permisosHarness'

// ANTES DE LA CORRECCIÓN: reproducción (H-B1, H-B2, anamnesis y suplantación del cliente) contra la réplica de producción SIN ninguna
// migración nueva, en PostgreSQL REAL (PGlite).
//
// QUÉ DEMUESTRA: cómo se comportan, con las definiciones copiadas tal cual de producción (políticas RLS, privilegios, restricciones,
// claves foráneas y funciones), las operaciones que haría un usuario que llama directamente a la API de datos.
// QUÉ NO DEMUESTRA: ni PostgREST, ni Supabase Auth (cómo se emiten los JWT, si el registro público está abierto, si hay sesiones
// anónimas), ni que producción esté hoy exactamente igual que esta copia (se leyó el 2026-11-20 con consultas de solo lectura).
// Cada prueba «REPRODUCCIÓN» confirma el comportamiento ACTUAL (el defecto). Cada prueba «DESEADO» usa `it.fails`: contra la base sin
// corregir falla a propósito; las mismas aserciones pasan como pruebas normales en permisosNutricionistas.despues.test.ts.
// Estas pruebas no se tocan al corregir: son la prueba de que la réplica reproduce el defecto (si dejaran de reproducirlo, las de
// «después» no demostrarían nada).

let db: PGlite
beforeAll(async () => { db = new PGlite(); await db.exec(ESQUEMA) }, 60_000)
afterAll(async () => { await db.close() })
const { aislada, como, intentar, filas, cuenta } = entorno(() => db)

describe('Controles: lo que el esquema copiado SÍ protege (si esto fallara, la reproducción no sería fiable)', () => {
  it('un profesional no ve las fichas ni los planes de otro profesional', aislada(async () => {
    const r = await como('authenticated', P, async () => ({
      fichasQ: await intentar(`select id from public.clientes where nutricionista_id = '${Q}'`),
      planesQ: await intentar(`select id from public.diet_plans where id = '${PLAN_D}'`),
      anamnesisQ: await intentar(`select id from public.anamnesis where client_id = '${FICHA_D}'`),
    }))
    for (const v of Object.values(r)) expect(v.ok && v.rows.length).toBe(0)
  }))
  it('el rol anónimo (sin sesión) no puede modificar nutricionistas', aislada(async () => {
    const r = await como('anon', null, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}' returning uid`))
    expect(r.ok && r.rows.length).toBe(0)
  }))
  it('una clienta vinculada NO puede ascender ni modificar la fila de su profesional (lo impide el WITH CHECK)', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}' returning uid`))
    expect(r.ok).toBe(false)
    expect((await filas(`select role from public.nutricionistas where uid = '${P}'`))[0].role).toBe('trainer')
  }))
  it('una clienta vinculada NO puede cambiar el uid de la fila de su profesional: lo frenan las claves foráneas', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`update public.nutricionistas set uid = '${UC}' where uid = '${P}' returning uid`))
    expect(r.ok).toBe(false)
    expect(r.ok === false && /foreign key|clave for/i.test(r.error)).toBe(true)
  }))
  it('una clienta de otro profesional NO puede borrar a P', aislada(async () => {
    const r = await como('authenticated', UD, () => intentar(`delete from public.nutricionistas where uid = '${P}' returning uid`))
    expect(r.ok && r.rows.length).toBe(0)
    expect(await cuenta('nutricionistas', `uid = '${P}'`)).toBe(1)
  }))
  it('una ficha sin reclamar (sin auth_user_id) no da ninguna capacidad sobre el profesional', aislada(async () => {
    const r = await como('authenticated', UN, () => intentar(`delete from public.nutricionistas where uid = '${P}' returning uid`))
    expect(r.ok && r.rows.length).toBe(0)
  }))
  it('USO LEGÍTIMO que debe seguir funcionando: la clienta vinculada LEE las preguntas de anamnesis de su profesional', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`select custom_anamnesis_questions from public.nutricionistas where uid = '${P}'`))
    expect(r.ok && r.rows.length).toBe(1)
  }))
  it('USO LEGÍTIMO: el profesional edita sus propios datos de marca', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`update public.nutricionistas set display_name = 'Nuevo nombre', accent_color = '#123456' where uid = '${P}' returning uid`))
    expect(r.ok && r.rows.length).toBe(1)
  }))
})

describe('H-B1: escalada de privilegios sobre nutricionistas.role / approved', () => {
  it('REPRODUCCIÓN: un profesional sin aprobar se asigna role = super_admin y approved = true con un UPDATE sobre su propia fila', aislada(async () => {
    const r = await como('authenticated', P, () =>
      intentar(`update public.nutricionistas set role = 'super_admin', approved = true where uid = '${P}' returning role, approved`))
    expect(r).toEqual({ ok: true, rows: [{ role: 'super_admin', approved: true }] })
    expect(await filas(`select role, approved from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'super_admin', approved: true }])
  }))
  it('REPRODUCCIÓN: con ese rol, P lee y modifica las fichas, la anamnesis y los planes de OTRO profesional (Q)', aislada(async () => {
    const antes = await como('authenticated', P, () => intentar(`select id from public.clientes where nutricionista_id = '${Q}'`))
    expect(antes.ok && antes.rows.length).toBe(0)
    await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}'`))
    const despues = await como('authenticated', P, async () => ({
      fichas: await intentar(`select id from public.clientes where nutricionista_id = '${Q}'`),
      anamnesis: await intentar(`select answers from public.anamnesis where client_id = '${FICHA_D}'`),
      plan: await intentar(`update public.diet_plans set kcal_target = 500 where id = '${PLAN_D}' returning kcal_target`),
    }))
    expect(despues.fichas.ok && despues.fichas.rows.length).toBe(1)
    expect(despues.anamnesis.ok && despues.anamnesis.rows).toEqual([{ answers: { embarazo_lactancia: 'Embarazo' } }])
    expect(despues.plan.ok && despues.plan.rows).toEqual([{ kcal_target: '500' }])
  }))
  it('REPRODUCCIÓN: la «aprobación» no es una barrera en el servidor — sin aprobar, P ya escribe planes de su clienta, y puede aprobarse solo', aislada(async () => {
    const sinAprobar = await como('authenticated', P, () => intentar(`update public.diet_plans set kcal_target = 1000 where id = '${PLAN_C}' returning kcal_target`))
    expect(sinAprobar.ok && sinAprobar.rows.length).toBe(1)
    const aprobarse = await como('authenticated', P, () => intentar(`update public.nutricionistas set approved = true where uid = '${P}' returning approved`))
    expect(aprobarse).toEqual({ ok: true, rows: [{ approved: true }] })
  }))
  it('REPRODUCCIÓN: el registro con account_mode = personal (dato que envía el propio usuario) nace aprobado, con ficha propia, y también puede escalar', aislada(async () => {
    const NUEVO = '00000000-0000-4000-8000-0000000000aa'
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${NUEVO}', 'nuevo@prueba.invalid', '{"signup_type":"nutricionista","account_mode":"personal"}')`)
    expect(await filas(`select approved, role, account_mode from public.nutricionistas where uid = '${NUEVO}'`)).toEqual([{ approved: true, role: 'trainer', account_mode: 'personal' }])
    expect(await cuenta('clientes', `nutricionista_id = '${NUEVO}' and auth_user_id = '${NUEVO}'`)).toBe(1)
    const r = await como('authenticated', NUEVO, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${NUEVO}' returning role`))
    expect(r).toEqual({ ok: true, rows: [{ role: 'super_admin' }] })
  }))
  it('REPRODUCCIÓN: el registro como profesional nace sin aprobar, pero se aprueba solo con un UPDATE', aislada(async () => {
    const NUEVO = '00000000-0000-4000-8000-0000000000ab'
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${NUEVO}', 'nuevo2@prueba.invalid', '{"signup_type":"nutricionista"}')`)
    expect(await filas(`select approved from public.nutricionistas where uid = '${NUEVO}'`)).toEqual([{ approved: false }])
    const r = await como('authenticated', NUEVO, () => intentar(`update public.nutricionistas set approved = true where uid = '${NUEVO}' returning approved`))
    expect(r).toEqual({ ok: true, rows: [{ approved: true }] })
  }))
  it('REPRODUCCIÓN (variante por INSERT): cualquier usuario con sesión, aunque sea una clienta, inserta una fila de profesional propia con role = super_admin y approved = true', aislada(async () => {
    const r = await como('authenticated', UN, () =>
      intentar(`insert into public.nutricionistas (uid, email, role, approved) values ('${UN}', 'n@prueba.invalid', 'super_admin', true) returning role, approved`))
    expect(r).toEqual({ ok: true, rows: [{ role: 'super_admin', approved: true }] })
    // y con ello lee los datos de todos los profesionales
    const ve = await como('authenticated', UN, () => intentar(`select id from public.clientes`))
    expect(ve.ok && ve.rows.length).toBe(3)
  }))
  // REVISADO (2026-11-22): contra el estado final PASA. Contrapartida normal: permisosNutricionistas.despues.test.ts «DESEADO (pasa a normal): un profesional no puede cambiar su propio role ni approved». Se conserva como documento del defecto original.
  it.fails('DESEADO: un profesional no puede cambiar su propio role ni approved (hoy sí puede, por eso esta prueba falla a propósito)', aislada(async () => {
    await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin', approved = true where uid = '${P}'`))
    expect(await filas(`select role, approved from public.nutricionistas where uid = '${P}'`)).toEqual([{ role: 'trainer', approved: false }])
  }))
  // REVISADO (2026-11-22): contra el estado final PASA. Contrapartida normal: permisosNutricionistas.despues.test.ts «DESEADO (pasa a normal): tras intentar ascender…».
  it.fails('DESEADO: ningún usuario sin privilegios de administración puede acceder a los datos de otro profesional tras intentar ascender (hoy sí)', aislada(async () => {
    await como('authenticated', P, () => intentar(`update public.nutricionistas set role = 'super_admin' where uid = '${P}'`))
    const r = await como('authenticated', P, () => intentar(`select id from public.clientes where nutricionista_id = '${Q}'`))
    expect(r.ok && r.rows.length).toBe(0)
  }))
})

describe('H-B2: borrado en cascada de la cuenta del profesional por una clienta vinculada', () => {
  it('REPRODUCCIÓN: la clienta vinculada (UC) borra la fila de su profesional P y se borran en cascada fichas, planes, versiones e historial', aislada(async () => {
    expect([await cuenta('clientes', `nutricionista_id = '${P}'`), await cuenta('diet_plans', `nutricionista_id = '${P}'`),
      await cuenta('diet_plan_versions', `plan_id = '${PLAN_C}'`), await cuenta('diet_plan_changes', `plan_id = '${PLAN_C}'`)]).toEqual([2, 1, 1, 1])
    const r = await como('authenticated', UC, () => intentar(`delete from public.nutricionistas where uid = '${P}' returning uid`))
    expect(r).toEqual({ ok: true, rows: [{ uid: P }] })
    expect([await cuenta('nutricionistas', `uid = '${P}'`), await cuenta('clientes', `nutricionista_id = '${P}'`), await cuenta('diet_plans', `nutricionista_id = '${P}'`),
      await cuenta('diet_plan_versions', `plan_id = '${PLAN_C}'`), await cuenta('diet_plan_changes', `plan_id = '${PLAN_C}'`)]).toEqual([0, 0, 0, 0, 0])
    // Lo de Q queda intacto, y el usuario de autenticación de P sigue existiendo (solo se pierden los datos de la aplicación).
    expect([await cuenta('nutricionistas', `uid = '${Q}'`), await cuenta('diet_plans', `nutricionista_id = '${Q}'`)]).toEqual([1, 1])
    expect(await filas(`select id from auth.users where id = '${P}'`)).toHaveLength(1)
  }))
  it('REPRODUCCIÓN: el borrado se lleva por delante el historial de cambios y las versiones (la trazabilidad no sobrevive)', aislada(async () => {
    await como('authenticated', UC, () => intentar(`delete from public.nutricionistas where uid = '${P}'`))
    expect(await cuenta('diet_plan_changes', `client_id = '${FICHA_C}'`)).toBe(0)
    expect(await cuenta('diet_plan_versions', `client_id = '${FICHA_C}'`)).toBe(0)
  }))
  it('REPRODUCCIÓN (privacidad): la clienta lee la fila COMPLETA de su profesional, no solo la marca ni las preguntas (email, rol, aprobación…)', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`select email, role, approved, account_mode from public.nutricionistas where uid = '${P}'`))
    expect(r).toEqual({ ok: true, rows: [{ email: 'p@prueba.invalid', role: 'trainer', approved: false, account_mode: 'professional' }] })
  }))
  it('REPRODUCCIÓN: el propio profesional también puede borrar su fila (política ALL): hay que decidir si esa es una operación legítima', aislada(async () => {
    const r = await como('authenticated', P, () => intentar(`delete from public.nutricionistas where uid = '${P}' returning uid`))
    expect(r.ok && r.rows.length).toBe(1)
  }))
  // REVISADO (2026-11-22): contra el estado final PASA. Contrapartida normal: permisosNutricionistas.despues.test.ts «DESEADO (pasa a normal): una clienta vinculada no puede borrar la fila de su profesional…».
  it.fails('DESEADO: una clienta vinculada no puede borrar la fila de su profesional (hoy sí, por eso esta prueba falla a propósito)', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`delete from public.nutricionistas where uid = '${P}' returning uid`))
    expect(r.ok ? r.rows.length : 0).toBe(0)
    expect(await cuenta('nutricionistas', `uid = '${P}'`)).toBe(1)
  }))
})

describe('Anamnesis y estado reproductivo: quién puede escribirlo y con qué garantías (FUERA del alcance de 0074: sigue igual)', () => {
  it('REPRODUCCIÓN: la clienta escribe cualquier contenido y fechas inventadas, y puede reescribir «Embarazo» por «No» sin dejar histórico', aislada(async () => {
    await como('authenticated', UC, () => intentar(
      `insert into public.anamnesis (client_id, answers, completed_at, updated_at) values ('${FICHA_C}', '{"embarazo_lactancia":"Embarazo"}', '2000-01-01', '2000-01-01')`))
    expect(await filas(`select answers, completed_at::date::text d from public.anamnesis where client_id = '${FICHA_C}'`)).toEqual([{ answers: { embarazo_lactancia: 'Embarazo' }, d: '2000-01-01' }])
    const r = await como('authenticated', UC, () => intentar(`update public.anamnesis set answers = '{"embarazo_lactancia":"No"}' where client_id = '${FICHA_C}' returning answers`))
    expect(r.ok && r.rows.length).toBe(1)
    expect(await cuenta('anamnesis', `client_id = '${FICHA_C}'`)).toBe(1) // una sola fila: el valor anterior se perdió
  }))
  it('REPRODUCCIÓN: valores sin sentido también se aceptan (no hay validación de contenido)', aislada(async () => {
    const r = await como('authenticated', UC, () => intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{"embarazo_lactancia":{"x":[1,2,3]}, "otro":null}') returning id`))
    expect(r.ok && r.rows.length).toBe(1)
  }))
  it('CONTROL: el profesional NO puede insertar ni modificar la anamnesis de su clienta (solo la lee)', aislada(async () => {
    const ins = await como('authenticated', P, () => intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{}')`))
    expect(ins.ok).toBe(false)
    await db.exec(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{"embarazo_lactancia":"No"}')`)
    const upd = await como('authenticated', P, () => intentar(`update public.anamnesis set answers = '{}' where client_id = '${FICHA_C}' returning id`))
    expect(upd.ok && upd.rows.length).toBe(0)
  }))
  it('REPRODUCCIÓN (suplantación 1): el profesional se pone a sí mismo como auth_user_id de su ficha y escribe la anamnesis como si fuera la clienta; la clienta real queda sin acceso', aislada(async () => {
    const cambia = await como('authenticated', P, () => intentar(`update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}' returning auth_user_id`))
    expect(cambia).toEqual({ ok: true, rows: [{ auth_user_id: P }] })
    const escribe = await como('authenticated', P, () => intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{"embarazo_lactancia":"No"}') returning id`))
    expect(escribe.ok && escribe.rows.length).toBe(1)
    const clientaReal = await como('authenticated', UC, () => intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{}')`))
    expect(clientaReal.ok).toBe(false)
  }))
  it('REPRODUCCIÓN (suplantación 2): con claim_client_by_token el profesional reclama una ficha sin reclamar y puede escribir la anamnesis; la clienta real, que llega después, no la recupera', aislada(async () => {
    await como('authenticated', P, () => intentar(`select public.claim_client_by_token('tokU')`))
    expect(await filas(`select auth_user_id from public.clientes where id = '${FICHA_U}'`)).toEqual([{ auth_user_id: P }])
    const escribe = await como('authenticated', P, () => intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_U}', '{"embarazo_lactancia":"No"}') returning id`))
    expect(escribe.ok && escribe.rows.length).toBe(1)
    await como('authenticated', UN, () => intentar(`select public.claim_client_by_token('tokU')`))
    expect(await filas(`select auth_user_id from public.clientes where id = '${FICHA_U}'`)).toEqual([{ auth_user_id: P }]) // la reclamación de UN no hizo nada
    const real = await como('authenticated', UN, () => intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_U}', '{}')`))
    expect(real.ok).toBe(false)
  }))
  it('REPRODUCCIÓN: cualquier usuario con sesión que conozca el enlace (token) de una ficha sin reclamar se queda con ella', aislada(async () => {
    await como('authenticated', UN, () => intentar(`select public.claim_client_by_token('tokU')`))
    expect(await filas(`select auth_user_id from public.clientes where id = '${FICHA_U}'`)).toEqual([{ auth_user_id: UN }])
  }))
  it('REPRODUCCIÓN: ningún dato de la fila indica quién escribió la anamnesis (no hay columna de autor ni de origen)', aislada(async () => {
    const columnas = (await filas(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'anamnesis' order by 1`)).map(c => c.column_name)
    expect(columnas).toEqual(['answers', 'client_id', 'completed_at', 'id', 'updated_at'])
  }))
  // REVISADO (2026-11-22): contra el estado final (0077+0078) PASA. Contrapartida normal: vinculacionClientas.test.ts «BYPASS 5 CERRADO (DESEADO del informe)». Antes de 0078 sigue fallando a propósito.
  it.fails('DESEADO (hallazgo aparte, NO lo cierra 0074): el profesional no puede cambiar el auth_user_id de la ficha de su clienta', aislada(async () => {
    await como('authenticated', P, () => intentar(`update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`))
    expect(await filas(`select auth_user_id from public.clientes where id = '${FICHA_C}'`)).toEqual([{ auth_user_id: UC }])
  }))
})
