import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { P, Q, UC, UD, UN, ADM, ESQUEMA, entorno } from './permisosHarness'

// Migración 0076: get_custom_anamnesis_questions(NULL) debe fallar con 42501. Se prueba contra DOS bases en PGlite:
//  · A = réplica + 0074 (lo que hay hoy en producción): reproduce el caso límite (NULL no da error, devuelve []).
//  · B = réplica + 0074 + 0076: NULL → 42501, y todo lo demás de la RPC idéntico a A.
// Qué NO demuestra: Supabase real (se comprueba aparte, con una transacción que se deshace sobre producción).
const sql = import.meta.glob('../../supabase/migrations/00{74,76}_*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const migracion = (n: string) => { const k = Object.keys(sql).find(x => x.includes('/' + n + '_')); if (!k) throw new Error('falta la migración ' + n); return sql[k] }

let dbA: PGlite
let dbB: PGlite
beforeAll(async () => {
  dbA = new PGlite(); await dbA.exec(ESQUEMA); await dbA.exec(migracion('0074'))
  dbB = new PGlite(); await dbB.exec(ESQUEMA); await dbB.exec(migracion('0074')); await dbB.exec(migracion('0076'))
}, 90_000)
afterAll(async () => { await dbA.close(); await dbB.close() })
const A = entorno(() => dbA)
const B = entorno(() => dbB)

const llamar = (e: typeof A, rol: string, uid: string | null, objetivo: string | null) =>
  e.como(rol, uid, () => e.intentar(`select public.get_custom_anamnesis_questions(${objetivo === null ? 'null::uuid' : `'${objetivo}'`}) as q`))
const conAdmin = (db: () => PGlite) => db().exec(`insert into auth.users (id, email) values ('${ADM}', 'adm@prueba.invalid');
  insert into public.nutricionistas (uid, email, approved, role) values ('${ADM}', 'adm@prueba.invalid', true, 'super_admin')`)
const codigo = (r: { ok: boolean; error?: string }) => (r.ok ? 'ok' : /sesión/.test(r.error ?? '') ? '28000' : /Sin acceso/.test(r.error ?? '') ? '42501' : /permission denied/.test(r.error ?? '') ? 'permiso' : 'otro:' + r.error)

describe('ANTES de 0076 (= producción hoy): el caso NULL no da error', () => {
  it('REPRODUCCIÓN: con un identificador NULL, un usuario con sesión recibe [] en lugar de 42501', A.aislada(async () => {
    expect(await llamar(A, 'authenticated', UN, null)).toEqual({ ok: true, rows: [{ q: [] }] })
  }))
})

describe('DESPUÉS de 0076: NULL → 42501 y el resto de la RPC no cambia', () => {
  it('NULL produce 42501 para cualquier usuario con sesión (profesional, clienta, sin vínculo, superadministrador)', B.aislada(async () => {
    await conAdmin(() => dbB)
    for (const uid of [P, Q, UC, UD, UN, ADM]) {
      const r = await llamar(B, 'authenticated', uid, null)
      expect(r.ok, uid).toBe(false)
      expect(codigo(r), uid).toBe('42501')
    }
  }))
  it('identificador PROPIO: el profesional recibe sus preguntas', B.aislada(async () => {
    expect(await llamar(B, 'authenticated', P, P)).toEqual({ ok: true, rows: [{ q: [{ id: 'q1', label: '¿Pregunta de P?' }] }] })
  }))
  it('identificador de SU profesional: la clienta vinculada recibe las preguntas; un superadministrador también', B.aislada(async () => {
    await conAdmin(() => dbB)
    const esperado = { ok: true, rows: [{ q: [{ id: 'q1', label: '¿Pregunta de P?' }] }] }
    expect(await llamar(B, 'authenticated', UC, P)).toEqual(esperado)
    expect(await llamar(B, 'authenticated', ADM, P)).toEqual(esperado)
  }))
  it('identificador AJENO: otra clienta, un usuario sin vínculo y un profesional ajeno reciben 42501', B.aislada(async () => {
    for (const uid of [UD, UN, Q]) expect(codigo(await llamar(B, 'authenticated', uid, P)), uid).toBe('42501')
  }))
  it('SIN SESIÓN (rol authenticated sin sub): error 28000, con NULL y con un identificador', B.aislada(async () => {
    expect(codigo(await llamar(B, 'authenticated', null, P))).toBe('28000')
    expect(codigo(await llamar(B, 'authenticated', null, null))).toBe('28000')
  }))
  it('ANON: no puede ejecutarla (ni con NULL ni con un identificador)', B.aislada(async () => {
    expect(codigo(await llamar(B, 'anon', null, null))).toBe('permiso')
    expect(codigo(await llamar(B, 'anon', null, P))).toBe('permiso')
  }))
  it('un profesional sin preguntas sigue recibiendo [] (lista vacía legítima, distinta de un error)', B.aislada(async () => {
    expect(await llamar(B, 'authenticated', Q, Q)).toEqual({ ok: true, rows: [{ q: [] }] })
  }))
})

describe('El resto del comportamiento NO cambia: A (0074) y B (0074 + 0076) responden igual a toda entrada no nula', () => {
  it('misma respuesta (resultado o código de error) para cada combinación de quien llama × objetivo no nulo, incluidos anon y sin sesión', async () => {
    const llamantes: [string, string | null][] = [['authenticated', P], ['authenticated', Q], ['authenticated', UC], ['authenticated', UD], ['authenticated', UN], ['authenticated', ADM], ['authenticated', null], ['anon', null]]
    const objetivos = [P, Q, UC, ADM, '00000000-0000-4000-8000-0000000000ee'] // incluye un identificador que no existe
    for (const e of [A, B]) { await e.aislada(async () => {})() } // calienta: ambas bases usables
    const recoger = async (e: typeof A, db: () => PGlite) => {
      const salida: Record<string, string> = {}
      await e.aislada(async () => {
        await conAdmin(db)
        for (const [rol, uid] of llamantes) for (const o of objetivos) {
          const r = await llamar(e, rol, uid, o)
          salida[`${rol}/${uid ?? 'sin-sub'}→${o}`] = r.ok ? JSON.stringify(r.rows) : codigo(r)
        }
      })()
      return salida
    }
    const a = await recoger(A, () => dbA)
    const b = await recoger(B, () => dbB)
    expect(Object.keys(a)).toHaveLength(llamantes.length * objetivos.length)
    expect(b).toEqual(a)
  })
  it('mismos atributos y privilegios: SECURITY DEFINER, STABLE, search_path vacío, propietario, tipo devuelto y ACL', async () => {
    const huella = async (db: PGlite) => (await db.query(`select prosecdef, provolatile, array_to_string(proconfig, ',') cfg, pg_get_userbyid(proowner) dueno, pg_get_function_result(oid) devuelve,
      pronargs, proargnames::text nombres, (select string_agg(a, ',' order by a) from unnest(proacl::text[]) a) acl,
      has_function_privilege('anon', oid, 'execute') anon, has_function_privilege('authenticated', oid, 'execute') auth_ejecuta
      from pg_proc where proname = 'get_custom_anamnesis_questions'`)).rows
    const a = await huella(dbA); const b = await huella(dbB)
    expect(a).toHaveLength(1); expect(b).toHaveLength(1)
    expect(b).toEqual(a)
    expect(b[0]).toMatchObject({ prosecdef: true, provolatile: 's', dueno: 'postgres', devuelve: 'jsonb', anon: false, auth_ejecuta: true })
  })
  it('la migración 0076 solo toca esa función: no contiene DML ni otras sentencias DDL', () => {
    const cuerpo = migracion('0076').split('\n').filter(l => !/^\s*--/.test(l)).join('\n')
    expect(cuerpo).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create\s+(table|policy|trigger|index))\b/i)
    const funciones = [...cuerpo.matchAll(/(?:create or replace function|revoke all on function|grant execute on function)\s+([\w.]+)/gi)].map(m => m[1])
    expect(new Set(funciones)).toEqual(new Set(['public.get_custom_anamnesis_questions']))
  })
})
