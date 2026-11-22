import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { P, Q, UC, UD, UN, FICHA_C, FICHA_U, FICHA_D, PLAN_C, ESQUEMA, EXTENSION_CLIENTE, entorno } from './permisosHarness'

// AUDITORÍA de clientes.auth_user_id y claim_client_by_token (reproducción aislada en PGlite; solo lectura de producción para copiar definiciones).
// ESTADO DE PARTIDA = producción tras 0074 y 0076 (ya aplicadas): la réplica del 2026-11-20 + 0074 + 0076 + las funciones y tablas de cliente
// copiadas de producción el 2026-11-21 (claim_client_by_token, get_client_auth_status_by_token, accept_consent, get_my_client_token,
// log_client_access; policies de weight_logs y access_log). No implementa ninguna corrección ni prepara migraciones.
//
// Cada «REPRODUCCIÓN» confirma el comportamiento ACTUAL (el defecto). Cada «CONTROL» confirma algo que hoy SÍ protege. Cada «DESEADO» usa
// `it.fails`: hoy falla a propósito. QUÉ NO DEMUESTRA: concurrencia real (PGlite tiene una sola conexión), PostgREST, GoTrue (registro,
// confirmación de email), ni el comportamiento de la pantalla (ClientRegister / ClientView se analizan leyendo el código).
const sql = import.meta.glob('../../supabase/migrations/00{74,76}_*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const migracion = (n: string) => { const k = Object.keys(sql).find(x => x.includes('/' + n + '_')); if (!k) throw new Error('falta ' + n); return sql[k] }

const TOKEN_QU = 'tokQU' // ficha SIN reclamar de Q
const FICHA_QU = '00000000-0000-4000-8000-0000000000f5'
const SEMILLA_EXTRA = `
  insert into public.clientes (id, nutricionista_id, token, auth_user_id, name, email) values
    ('${FICHA_QU}', '${Q}', '${TOKEN_QU}', null, 'Clienta de Q sin reclamar', 'clienta.legitima@prueba.invalid');
  update public.clientes set email = 'clienta.legitima@prueba.invalid' where id = '${FICHA_U}';
  insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_C}', 61.5), ('${FICHA_D}', 70.2);
`

let db: PGlite
beforeAll(async () => { db = new PGlite(); await db.exec(ESQUEMA); await db.exec(migracion('0074')); await db.exec(migracion('0076')); await db.exec(EXTENSION_CLIENTE) }, 90_000)
afterAll(async () => { await db.close() })
const { como, intentar, filas, cuenta } = entorno(() => db)
const aislada = (fn: () => Promise<void>) => async () => {
  await db.exec('set session authorization postgres'); await db.exec('begin')
  try { await db.exec((await import('./permisosHarness')).SEMILLA); await db.exec(SEMILLA_EXTRA); await fn() } finally { await db.exec('rollback'); await db.exec('set session authorization postgres') }
}
const reclamar = (uid: string | null, token: string, rol = 'authenticated') => como(rol, uid, () => intentar(`select public.claim_client_by_token('${token}') as r`))
const dueno = async (id: string) => (await filas(`select auth_user_id from public.clientes where id = '${id}'`))[0]?.auth_user_id ?? null
const lee = (uid: string, sqlTexto: string) => como('authenticated', uid, () => intentar(sqlTexto))

describe('A. Apropiación de fichas sin reclamar', () => {
  it('REPRODUCCIÓN: cualquier usuario con sesión que conozca el token de una ficha sin reclamar se convierte en su titular', aislada(async () => {
    expect(await dueno(FICHA_QU)).toBeNull()
    await reclamar(UN, TOKEN_QU)
    expect(await dueno(FICHA_QU)).toBe(UN)
  }))
  it('REPRODUCCIÓN: no se comprueba que el usuario sea la persona de la ficha — su email NO coincide con clientes.email y la reclamación se acepta igual', aislada(async () => {
    // UN es n@prueba.invalid; la ficha es de clienta.legitima@prueba.invalid
    await reclamar(UN, 'tokU')
    expect(await dueno(FICHA_U)).toBe(UN)
  }))
  it('REPRODUCCIÓN: el titular obtenido así lee el plan, los pesos y escribe la anamnesis y los registros como la clienta', aislada(async () => {
    await db.exec(`insert into public.diet_plans (client_id, nutricionista_id, name, kcal_target) values ('${FICHA_QU}', '${Q}', 'Plan de la clienta de Q', 1700);
      insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_QU}', 58.0)`)
    await reclamar(UN, TOKEN_QU)
    const r = await como('authenticated', UN, async () => ({
      plan: await intentar(`select name from public.diet_plans where client_id = '${FICHA_QU}'`),
      pesos: await intentar(`select weight_kg from public.weight_logs where client_id = '${FICHA_QU}'`),
      anamnesis: await intentar(`insert into public.anamnesis (client_id, answers) values ('${FICHA_QU}', '{"embarazo_lactancia":"No"}') returning id`),
      registro: await intentar(`insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_QU}', 40) returning id`),
    }))
    expect(r.plan).toEqual({ ok: true, rows: [{ name: 'Plan de la clienta de Q' }] })
    expect(r.pesos).toEqual({ ok: true, rows: [{ weight_kg: '58.0' }] })
    expect(r.anamnesis.ok && r.anamnesis.rows.length).toBe(1)
    expect(r.registro.ok && r.registro.rows.length).toBe(1)
  }))
  it('REPRODUCCIÓN: un PROFESIONAL (P) que obtiene el token de una ficha de otro profesional (Q) la reclama y accede a sus datos; además lee la fila completa de Q', aislada(async () => {
    await reclamar(P, TOKEN_QU)
    expect(await dueno(FICHA_QU)).toBe(P)
    const r = await como('authenticated', P, async () => ({
      fichaDeQ: await intentar(`select id from public.weight_logs where client_id = '${FICHA_QU}'`),
      filaDeQ: await intentar(`select email, role, approved from public.nutricionistas where uid = '${Q}'`), // por la rama de clienta de nutricionistas_select (0075 la retira)
    }))
    expect(r.fichaDeQ.ok).toBe(true)
    expect(r.filaDeQ).toEqual({ ok: true, rows: [{ email: 'q@prueba.invalid', role: 'trainer', approved: true }] })
  }))
  it('REPRODUCCIÓN: la función no informa del resultado — devuelve lo mismo (void) si reclamó, si ya estaba reclamada o si el token no existe', aislada(async () => {
    const conExito = await reclamar(UN, TOKEN_QU)
    const yaReclamada = await reclamar(UD, TOKEN_QU)
    const inexistente = await reclamar(UN, 'no-existe')
    for (const r of [conExito, yaReclamada, inexistente]) expect(r).toEqual({ ok: true, rows: [{ r: '' }] }) // void: sin ningún dato
  }))
  it('CONTROL: el rol anónimo (sin sesión) no reclama nada (auth.uid() es NULL y la ficha queda sin dueño)', aislada(async () => {
    await reclamar(null, TOKEN_QU, 'anon')
    expect(await dueno(FICHA_QU)).toBeNull()
  }))
  it('CONTROL: sin el token (o con uno distinto) no se obtiene nada; los tokens de 128 bits no se enumeran', aislada(async () => {
    await reclamar(UN, 'tokQ')
    await reclamar(UN, '')
    expect(await dueno(FICHA_QU)).toBeNull()
  }))
  it('REPRODUCCIÓN (fuga): la RPC anónima get_client_auth_status_by_token revela, a quien tenga el token, el id de la ficha y el uid del usuario vinculado', aislada(async () => {
    const r = await como('anon', null, () => intentar(`select id, name, auth_user_id from public.get_client_auth_status_by_token('tokC')`))
    expect(r).toEqual({ ok: true, rows: [{ id: FICHA_C, name: 'Clienta C', auth_user_id: UC }] })
  }))
  // REVISADO (2026-11-22): contra el estado final PASA (la reclamación antigua ya no existe y la nueva exige email igual y confirmado). Contrapartida: vinculacionClientas.test.ts «BYPASS 1/2 CERRADO…».
  it.fails('DESEADO: una ficha con email no se puede reclamar con una cuenta que no sea de esa persona (hoy sí: cualquier sesión + token)', aislada(async () => {
    await reclamar(UN, 'tokU')
    expect(await dueno(FICHA_U)).toBeNull()
  }))
  // REVISADO (2026-11-22): SUSTITUIDA: la función antigua ya no es el mecanismo (desde 0078 lanza un error explícito). El deseo se cumple con claim_client_with_invitation: vinculacionClientas.test.ts «BYPASS 4 CERRADO: el resultado es explícito…».
  it.fails('DESEADO: la reclamación informa de su resultado (reclamada / ya reclamada / token inválido) en vez de devolver siempre lo mismo', aislada(async () => {
    const yaReclamada = await reclamar(UD, 'tokC')
    expect(yaReclamada.ok && yaReclamada.rows[0].r).toBeTruthy()
  }))
})

describe('B. Colisiones entre reclamaciones', () => {
  it('REPRODUCCIÓN: la primera gana; la segunda es un no-op SILENCIOSO (sin error) y el segundo usuario queda sin ficha aunque la pantalla diga «todo listo»', aislada(async () => {
    await reclamar(UN, TOKEN_QU)
    const segunda = await reclamar(UD, TOKEN_QU)
    expect(segunda.ok).toBe(true)
    expect(await dueno(FICHA_QU)).toBe(UN)
    const ficha = await lee(UD, `select id from public.clientes where id = '${FICHA_QU}'`) // UD no puede ni ver la ficha (no tiene policy de cliente)
    expect(ficha).toEqual({ ok: true, rows: [] })
    expect((await lee(UD, `select public.get_my_client_token() as t`))).toEqual({ ok: true, rows: [{ t: 'tokD' }] }) // sigue con la suya, nada de la nueva
  }))
  it('REPRODUCCIÓN: un mismo usuario puede reclamar varias fichas (de profesionales distintos); get_my_client_token devuelve solo una y el usuario es «cliente» de ambos profesionales', aislada(async () => {
    await reclamar(UC, TOKEN_QU) // UC ya es titular de FICHA_C (de P)
    expect(await dueno(FICHA_QU)).toBe(UC)
    expect(await cuenta('clientes', `auth_user_id = '${UC}'`)).toBe(2)
    const veAmbos = await lee(UC, `select uid from public.nutricionistas order by uid`)
    expect(veAmbos.ok && veAmbos.rows.map(r => r.uid)).toEqual([P, Q])
  }))
  it('NO DEMOSTRADO EN PGlite (una sola conexión): la carrera real entre dos reclamaciones simultáneas. Por la semántica documentada de READ COMMITTED el UPDATE se reevalúa tras el commit del primero y la condición «auth_user_id is null» ya no se cumple, así que no habría doble titular — es una hipótesis a confirmar en Supabase real', () => {
    expect(true).toBe(true)
  })
})

describe('C. Suplantación de clientes ya vinculados', () => {
  it('CONTROL: reclamar el token de una ficha YA vinculada no la roba (la condición «auth_user_id is null» lo impide)', aislada(async () => {
    await reclamar(UN, 'tokC')
    await reclamar(P, 'tokC')
    expect(await dueno(FICHA_C)).toBe(UC)
  }))
  it('CONTROL: la propia clienta no puede modificar su ficha (no hay política de cliente en clientes): tampoco desvincularse ni vincular a otro', aislada(async () => {
    const r = await lee(UC, `update public.clientes set auth_user_id = null where id = '${FICHA_C}' returning id`)
    expect(r.ok ? r.rows.length : 0).toBe(0)
    expect(await dueno(FICHA_C)).toBe(UC)
  }))
  it('CONTROL: otro profesional (Q) no puede cambiar el vínculo de las fichas de P', aislada(async () => {
    const r = await lee(Q, `update public.clientes set auth_user_id = '${Q}' where id = '${FICHA_C}' returning id`)
    expect(r.ok ? r.rows.length : 0).toBe(0)
    expect(await dueno(FICHA_C)).toBe(UC)
  }))
  it('REPRODUCCIÓN: el profesional dueño de la ficha cambia auth_user_id a su propio uid y pasa a ser el titular; la clienta real pierde el acceso a todo (18 tablas con la misma función)', aislada(async () => {
    const cambia = await lee(P, `update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}' returning auth_user_id`)
    expect(cambia).toEqual({ ok: true, rows: [{ auth_user_id: P }] })
    const impostor = await como('authenticated', P, async () => ({
      plan: await intentar(`select name from public.diet_plans where client_id = '${FICHA_C}'`),
      registro: await intentar(`insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_C}', 99) returning id`),
    }))
    expect(impostor.registro.ok && impostor.registro.rows.length).toBe(1)
    const real = await como('authenticated', UC, async () => ({
      pesos: await intentar(`select weight_kg from public.weight_logs where client_id = '${FICHA_C}'`),
      escribe: await intentar(`insert into public.weight_logs (client_id, weight_kg) values ('${FICHA_C}', 61) returning id`),
    }))
    expect(real.pesos.ok && real.pesos.rows.every(r => r.weight_kg === '99')).toBe(true) // ve solo lo del impostor o nada: ya no lo suyo
    expect(real.escribe.ok).toBe(false)
  }))
  it('REPRODUCCIÓN: el profesional vincula la ficha a OTRO usuario cualquiera cuyo uid conozca (p. ej. la clienta de otro profesional): esa persona pasa a ver y escribir los datos de la ficha ajena', aislada(async () => {
    // (el uid de un tercero no es fácil de conocer: solo lo da get_client_auth_status_by_token con SU token; la prueba demuestra que, conocido, la base lo acepta)
    await lee(P, `update public.clientes set auth_user_id = '${UD}' where id = '${FICHA_C}'`)
    const r = await lee(UD, `select weight_kg from public.weight_logs where client_id = '${FICHA_C}'`)
    expect(r).toEqual({ ok: true, rows: [{ weight_kg: '61.5' }] })
  }))
  it('REPRODUCCIÓN: el titular suplantado firma el consentimiento con cualquier nombre y queda registrado como aceptado (prueba de consentimiento falseable)', aislada(async () => {
    await lee(P, `update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`)
    await como('authenticated', P, () => intentar(`select public.accept_consent('tokC', 'Nombre de la clienta real')`))
    const f = await filas(`select consent_signed_name, consent_accepted_at is not null firmado from public.clientes where id = '${FICHA_C}'`)
    expect(f).toEqual([{ consent_signed_name: 'Nombre de la clienta real', firmado: true }])
  }))
  it('REPRODUCCIÓN: la clienta suplantada no puede recuperar nada: su reclamación es un no-op y su escritura en anamnesis sigue denegada', aislada(async () => {
    await lee(P, `update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`)
    await reclamar(UC, 'tokC')
    expect(await dueno(FICHA_C)).toBe(P)
    expect((await lee(UC, `insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{}')`)).ok).toBe(false)
  }))
  // REVISADO (2026-11-22): contra el estado final PASA. Contrapartida: vinculacionClientas.test.ts «BYPASS 5 CERRADO (DESEADO del informe)».
  it.fails('DESEADO (hallazgo ya registrado): el profesional no puede cambiar auth_user_id de la ficha de su clienta con un UPDATE directo', aislada(async () => {
    await lee(P, `update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`)
    expect(await dueno(FICHA_C)).toBe(UC)
  }))
})

describe('D. Recuperación de la ficha por la clienta legítima', () => {
  it('REPRODUCCIÓN: «Regenerar enlace» (UPDATE del token) NO desvincula al titular actual: el impostor conserva el acceso y el enlace nuevo solo sirve para fichas sin titular', aislada(async () => {
    await reclamar(UN, TOKEN_QU) // impostor
    await lee(Q, `update public.clientes set token = 'token-nuevo' where id = '${FICHA_QU}'`) // el profesional regenera el enlace (como hace el front-end)
    expect(await dueno(FICHA_QU)).toBe(UN)
    expect((await lee(UN, `select count(*)::int n from public.weight_logs where client_id = '${FICHA_QU}'`)).ok).toBe(true) // sigue dentro
    await reclamar(UD, 'token-nuevo') // la clienta legítima usa el enlace nuevo: no-op
    expect(await dueno(FICHA_QU)).toBe(UN)
  }))
  it('REPRODUCCIÓN: la única vía de recuperación es un UPDATE directo (auth_user_id = NULL) — no existe en la aplicación (el front-end solo lee auth_user_id y la función de borrado) — y tras él la clienta legítima SÍ puede reclamar', aislada(async () => {
    await reclamar(UN, TOKEN_QU)
    const libera = await lee(Q, `update public.clientes set auth_user_id = null where id = '${FICHA_QU}' returning id`)
    expect(libera.ok && libera.rows.length).toBe(1)
    await db.exec(`update public.clientes set token = 'token-nuevo' where id = '${FICHA_QU}'`)
    await reclamar(UD, 'token-nuevo')
    expect(await dueno(FICHA_QU)).toBe(UD)
  }))
})

describe('E. Trazabilidad y atribución', () => {
  it('REPRODUCCIÓN: clientes no guarda quién ni cuándo vinculó la ficha (sin claimed_at, claimed_by ni historial de vínculos)', aislada(async () => {
    const columnas = (await filas(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'clientes' order by 1`)).map(c => c.column_name as string)
    expect(columnas.filter(c => /claim|link|vincul/i.test(c))).toEqual([])
    expect((await filas(`select table_name from information_schema.tables where table_schema = 'public' and table_name ~* 'link|claim|vincul'`))).toEqual([])
  }))
  it('REPRODUCCIÓN: ni la reclamación ni el cambio de auth_user_id dejan rastro (no hay triggers en clientes y access_log no registra esas acciones)', aislada(async () => {
    await reclamar(UN, TOKEN_QU)
    await lee(P, `update public.clientes set auth_user_id = '${P}' where id = '${FICHA_C}'`)
    expect(await filas(`select tgname from pg_trigger where tgrelid = 'public.clientes'::regclass and not tgisinternal`)).toEqual([])
    expect(await cuenta('access_log')).toBe(0)
  }))
  it('REPRODUCCIÓN: access_log solo admite acciones del profesional (ficha, exportación, informe); una clienta no puede registrar nada y no existe una acción «vinculación»', aislada(async () => {
    expect((await lee(UC, `select public.log_client_access('${FICHA_C}', 'ficha')`)).ok).toBe(false)
    const accion = await lee(P, `select public.log_client_access('${FICHA_C}', 'vinculacion')`)
    expect(accion.ok === false && /Acción no válida/.test(accion.error)).toBe(true)
  }))
  it('REPRODUCCIÓN: lo que escribe el titular (impostor o legítimo) es indistinguible: weight_logs y anamnesis no guardan autor', aislada(async () => {
    const col = async (t: string) => (await filas(`select column_name from information_schema.columns where table_schema = 'public' and table_name = '${t}' order by 1`)).map(c => c.column_name)
    expect(await col('weight_logs')).toEqual(['client_id', 'id', 'logged_at', 'weight_kg'])
    expect(await col('anamnesis')).toEqual(['answers', 'client_id', 'completed_at', 'id', 'updated_at'])
  }))
  // REVISADO (2026-11-22): SUSTITUIDA: access_log no es donde se registra la vinculación; el deseo se cumple con client_link_events: vinculacionClientas.test.ts «vincular, desvincular y reasignar dejan un evento cada uno» y la prueba de solo inserción.
  it.fails('DESEADO: vincular, desvincular y reasignar una ficha deja un registro inmutable (quién, cuándo, uid anterior y nuevo)', aislada(async () => {
    await reclamar(UN, TOKEN_QU)
    expect(await cuenta('access_log')).toBeGreaterThan(0)
  }))
})

describe('F. Lo que sí funciona (controles de aislamiento entre clientes y profesionales)', () => {
  it('una clienta vinculada no ve las fichas, pesos ni planes de otra clienta', aislada(async () => {
    const r = await como('authenticated', UC, async () => ({
      pesosAjenos: await intentar(`select id from public.weight_logs where client_id = '${FICHA_D}'`),
      planAjeno: await intentar(`select id from public.diet_plans where client_id = '${FICHA_D}'`),
      fichas: await intentar(`select id from public.clientes`),
    }))
    expect(r.pesosAjenos).toEqual({ ok: true, rows: [] })
    expect(r.planAjeno).toEqual({ ok: true, rows: [] })
    expect(r.fichas).toEqual({ ok: true, rows: [] })
  }))
  it('get_my_client_token no es ejecutable por anon, y accept_consent solo actúa si el llamante es el titular', aislada(async () => {
    expect((await como('anon', null, () => intentar(`select public.get_my_client_token()`))).ok).toBe(false)
    await como('authenticated', UN, () => intentar(`select public.accept_consent('tokC', 'Intruso')`))
    expect(await filas(`select consent_signed_name from public.clientes where id = '${FICHA_C}'`)).toEqual([{ consent_signed_name: null }])
  }))
  it('la anamnesis y los planes de un cliente vinculado solo son visibles para él y para SU profesional', aislada(async () => {
    await db.exec(`insert into public.anamnesis (client_id, answers) values ('${FICHA_C}', '{"embarazo_lactancia":"No"}')`)
    expect((await lee(UC, `select id from public.anamnesis where client_id = '${FICHA_C}'`)).ok).toBe(true)
    for (const quien of [Q, UD, UN]) expect(await lee(quien, `select id from public.anamnesis where client_id = '${FICHA_C}'`), quien).toEqual({ ok: true, rows: [] })
    expect(await lee(P, `select id from public.diet_plans where id = '${PLAN_C}'`)).toMatchObject({ ok: true })
  }))
})
