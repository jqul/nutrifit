import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { STANDARD_METRICS, missingStandardMetrics } from './bodyMetrics'

// Pruebas de la migración 0073 contra PostgreSQL REAL (PGlite: el motor de Postgres compilado a WebAssembly), no contra un
// simulador de SQL. Qué NO cubre: PostgREST (la capa que traduce `upsert(..., { onConflict })` a SQL) ni el Supabase real; aquí
// se ejecuta el SQL equivalente que PostgREST genera (`INSERT ... SELECT FROM json_populate_recordset(...) ON CONFLICT (...) DO NOTHING`).
const sql = import.meta.glob('../../supabase/migrations/00{66,73}_*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const migration = (n: string) => {
  const key = Object.keys(sql).find(k => k.includes(`/${n}_`))
  if (!key) throw new Error(`falta la migración ${n}`)
  return sql[key]
}

const A = '00000000-0000-4000-8000-00000000000a' // nutricionista A
const B = '00000000-0000-4000-8000-00000000000b' // nutricionista B
const CLIENTE_A = '00000000-0000-4000-8000-0000000000c1' // cliente de A (id de la ficha)
const USUARIO_CLIENTE_A = '00000000-0000-4000-8000-0000000000c2' // su usuario (auth.uid())

// Lo mínimo que 0066 necesita de otras migraciones: las tablas a las que apunta y las funciones de las políticas RLS. Las
// funciones son versiones reducidas (la lógica real vive en otras migraciones); lo que se prueba aquí son el índice y cómo
// se combinan las políticas con el ON CONFLICT.
const PREREQUISITOS = `
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema private;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table public.nutricionistas (uid uuid primary key);
  create table public.clientes (id uuid primary key, nutricionista_id uuid not null references public.nutricionistas(uid), user_id uuid);
  create function private.is_super_admin() returns boolean language sql stable as $$ select false $$;
  create function private.is_client_of_nutricionista(n uuid) returns boolean language sql stable security definer
    as $$ select exists (select 1 from public.clientes c where c.nutricionista_id = n and c.user_id = auth.uid()) $$;
  create function private.is_nutricionista_of_client(c uuid) returns boolean language sql stable security definer
    as $$ select exists (select 1 from public.clientes x where x.id = c and x.nutricionista_id = auth.uid()) $$;
  create function private.is_owner_client(c uuid) returns boolean language sql stable security definer
    as $$ select exists (select 1 from public.clientes x where x.id = c and x.user_id = auth.uid()) $$;
  insert into public.nutricionistas values ('${A}'), ('${B}');
  insert into public.clientes values ('${CLIENTE_A}', '${A}', '${USUARIO_CLIENTE_A}');
`
const PERMISOS = `
  grant usage on schema public, private, auth to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema private to authenticated;
  grant execute on all functions in schema auth to authenticated;
`

async function baseConMigracion0066() {
  const db = new PGlite()
  await db.exec(PREREQUISITOS)
  await db.exec(migration('0066'))
  await db.exec(PERMISOS)
  return db
}

/** Actúa como un usuario con sesión (RLS activa). `null` = el rol de la base (sin RLS). */
async function como<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false)`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`) }
}

/**
 * Lo mismo que BodyMetricsCard.load(): lee lo que hay, calcula las estándar que faltan (con la función real de la app) y las
 * inserta con el SQL que PostgREST genera para `upsert(..., { onConflict: 'nutricionista_id,key', ignoreDuplicates: true })`.
 */
async function sembrarEstandar(db: PGlite, nutricionistaId: string) {
  const { rows } = await db.query<{ key: string | null; sort_order: number }>('select key, sort_order from public.metric_definitions where nutricionista_id = $1', [nutricionistaId])
  const missing = missingStandardMetrics(rows)
  if (missing.length === 0) return 0
  const base = rows.reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), -1) + 1
  const payload = missing.map((m, i) => ({ nutricionista_id: nutricionistaId, key: m.key, name: m.name, unit: m.unit, sort_order: base + i }))
  await db.query(
    `insert into public.metric_definitions ("nutricionista_id","key","name","unit","sort_order")
     select "nutricionista_id","key","name","unit","sort_order" from json_populate_recordset(null::public.metric_definitions, $1::json)
     on conflict ("nutricionista_id","key") do nothing`,
    [JSON.stringify(payload)])
  return missing.length
}

const contar = async (db: PGlite, where = 'true') => Number((await db.query<{ n: string }>(`select count(*) n from public.metric_definitions where ${where}`)).rows[0].n)
const indices = async (db: PGlite) => (await db.query<{ indexname: string; indexdef: string }>(`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'metric_definitions' order by indexname`)).rows
const politicas = async (db: PGlite) => (await db.query<{ policyname: string }>(`select policyname || ' ' || cmd || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') as policyname from pg_policies where tablename in ('metric_definitions', 'body_metrics') order by 1`)).rows.map(r => r.policyname)
const restricciones = async (db: PGlite) => (await db.query<{ d: string }>(`select conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) as d from pg_constraint where conrelid in ('public.metric_definitions'::regclass, 'public.body_metrics'::regclass) order by 1`)).rows.map(r => r.d)

describe('migración 0073 (texto)', () => {
  const texto = migration('0073')
  const ejecutable = texto.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  it('crea primero el índice nuevo y después borra el anterior', () => {
    const crear = ejecutable.indexOf('create unique index uq_metric_definitions_nutricionista_key')
    const borrar = ejecutable.indexOf('drop index public.uq_metric_definitions_key')
    expect(crear).toBeGreaterThanOrEqual(0)
    expect(borrar).toBeGreaterThan(crear)
  })
  it('el índice nuevo no es parcial', () => {
    expect(ejecutable).toMatch(/create unique index uq_metric_definitions_nutricionista_key on public\.metric_definitions \(nutricionista_id, key\);/)
    expect(ejecutable).not.toMatch(/\bwhere\b/i)
  })
  it('solo toca esos dos índices: ni datos, ni políticas, ni restricciones', () => {
    expect(ejecutable).not.toMatch(/\b(insert|update|delete|alter|policy|constraint|truncate)\b/i)
  })
})

describe('antes de la 0073: el error 42P10 (índice parcial)', () => {
  let db: PGlite
  beforeAll(async () => { db = await baseConMigracion0066() }, 60_000)
  afterAll(async () => { await db.close() })

  it('el índice de la 0066 es parcial', async () => {
    const parcial = (await indices(db)).find(i => i.indexname === 'uq_metric_definitions_key')
    expect(parcial?.indexdef).toMatch(/WHERE \(key IS NOT NULL\)/)
  })
  it('el upsert de las estándar falla con 42P10 (el 400 de la app)', async () => {
    await expect(sembrarEstandar(db, A)).rejects.toMatchObject({ code: '42P10' })
    expect(await contar(db)).toBe(0) // y no se crea nada, como en producción
  })
  it('solo un ON CONFLICT que repita el predicado (algo que PostgREST no permite enviar) usaría el índice parcial', async () => {
    await expect(db.query(`insert into public.metric_definitions (nutricionista_id, key, name) values ('${A}', 'waist_cm', 'Cintura') on conflict (nutricionista_id, key) where key is not null do nothing`)).resolves.toBeDefined()
    await db.exec(`delete from public.metric_definitions`)
  })
})

describe('después de la 0073', () => {
  let db: PGlite
  beforeAll(async () => {
    db = await baseConMigracion0066()
    await db.exec(migration('0073'))
  }, 60_000)
  afterAll(async () => { await db.close() })

  it('el índice anterior ya no existe y el nuevo es único y no parcial', async () => {
    const ix = await indices(db)
    expect(ix.map(i => i.indexname)).not.toContain('uq_metric_definitions_key')
    const nuevo = ix.find(i => i.indexname === 'uq_metric_definitions_nutricionista_key')
    expect(nuevo?.indexdef).toMatch(/CREATE UNIQUE INDEX .* \(nutricionista_id, key\)$/)
    expect(nuevo?.indexdef).not.toMatch(/WHERE/)
  })

  it('el upsert de las estándar funciona y crea las seis', async () => {
    expect(await sembrarEstandar(db, A)).toBe(STANDARD_METRICS.length)
    expect(await contar(db, `nutricionista_id = '${A}'`)).toBe(STANDARD_METRICS.length)
    const claves = (await db.query<{ key: string }>(`select key from public.metric_definitions where nutricionista_id = '${A}' order by sort_order`)).rows.map(r => r.key)
    expect(claves).toEqual(STANDARD_METRICS.map(m => m.key))
  })

  it('las seis se crean una sola vez: recargar la ficha no duplica ni da error', async () => {
    for (let recarga = 0; recarga < 3; recarga++) expect(await sembrarEstandar(db, A)).toBe(0) // nada que crear
    expect(await contar(db, `nutricionista_id = '${A}'`)).toBe(STANDARD_METRICS.length)
  })

  it('aunque la app no se entere de que ya existen (dos pestañas a la vez), el ON CONFLICT las ignora sin error', async () => {
    const payload = JSON.stringify(STANDARD_METRICS.map((m, i) => ({ nutricionista_id: A, key: m.key, name: m.name, unit: m.unit, sort_order: i })))
    const insertar = () => db.query(
      `insert into public.metric_definitions ("nutricionista_id","key","name","unit","sort_order")
       select "nutricionista_id","key","name","unit","sort_order" from json_populate_recordset(null::public.metric_definitions, $1::json)
       on conflict ("nutricionista_id","key") do nothing`, [payload])
    await expect(insertar()).resolves.toBeDefined()
    await expect(insertar()).resolves.toBeDefined()
    expect(await contar(db, `nutricionista_id = '${A}'`)).toBe(STANDARD_METRICS.length)
  })

  it('si falta alguna estándar solo se crean las que faltan', async () => {
    await db.exec(`delete from public.metric_definitions where nutricionista_id = '${A}' and key in ('hip_cm', 'arm_cm')`)
    expect(await sembrarEstandar(db, A)).toBe(2)
    expect(await contar(db, `nutricionista_id = '${A}'`)).toBe(STANDARD_METRICS.length)
  })

  it('varias métricas propias (key NULL) siguen permitidas, incluso con el mismo nombre', async () => {
    await db.exec(`insert into public.metric_definitions (nutricionista_id, name) values ('${A}', 'Pliegue tricipital'), ('${A}', 'Pliegue tricipital'), ('${A}', 'Masa muscular')`)
    expect(await contar(db, `nutricionista_id = '${A}' and key is null`)).toBe(3)
    // y no estorban a la siembra de las estándar
    expect(await sembrarEstandar(db, A)).toBe(0)
  })

  it('un duplicado (mismo nutricionista y misma key) se rechaza con 23505', async () => {
    await expect(db.exec(`insert into public.metric_definitions (nutricionista_id, key, name) values ('${A}', 'waist_cm', 'Cintura otra vez')`)).rejects.toMatchObject({ code: '23505' })
  })

  it('otro nutricionista sí puede tener las mismas keys', async () => {
    expect(await sembrarEstandar(db, B)).toBe(STANDARD_METRICS.length)
    expect(await contar(db, `key = 'waist_cm'`)).toBe(2)
  })
})

describe('después de la 0073: políticas RLS', () => {
  let db: PGlite
  beforeAll(async () => {
    db = await baseConMigracion0066()
    await db.exec(migration('0073'))
  }, 60_000)
  afterAll(async () => { await db.close() })

  it('el nutricionista siembra sus estándar con RLS activa (ON CONFLICT DO NOTHING solo necesita la política de insertar)', async () => {
    await como(db, A, async () => {
      expect(await sembrarEstandar(db, A)).toBe(STANDARD_METRICS.length)
      expect(await sembrarEstandar(db, A)).toBe(0)
    })
    expect(await contar(db, `nutricionista_id = '${A}'`)).toBe(STANDARD_METRICS.length)
  })

  it('no puede sembrar a nombre de otro nutricionista (42501)', async () => {
    await como(db, A, async () => {
      await expect(db.query(`insert into public.metric_definitions (nutricionista_id, key, name) values ('${B}', 'waist_cm', 'Cintura') on conflict (nutricionista_id, key) do nothing`)).rejects.toMatchObject({ code: '42501' })
    })
    expect(await contar(db, `nutricionista_id = '${B}'`)).toBe(0)
  })

  it('cada nutricionista ve solo las suyas', async () => {
    await como(db, B, async () => { await sembrarEstandar(db, B) })
    await como(db, A, async () => expect(await contar(db)).toBe(STANDARD_METRICS.length))
    await como(db, B, async () => expect(await contar(db)).toBe(STANDARD_METRICS.length))
  })

  it('el cliente solo ve las métricas visibles de su nutricionista', async () => {
    await db.exec(`update public.metric_definitions set client_visible = false where nutricionista_id = '${A}' and key in ('hip_cm', 'chest_cm')`)
    await como(db, USUARIO_CLIENTE_A, async () => {
      const { rows } = await db.query<{ key: string; nutricionista_id: string }>('select key, nutricionista_id from public.metric_definitions order by sort_order')
      expect(rows.length).toBe(STANDARD_METRICS.length - 2)
      expect(rows.every(r => r.nutricionista_id === A)).toBe(true)
      expect(rows.map(r => r.key)).not.toContain('hip_cm')
      // y no puede escribir
      await expect(db.query(`insert into public.metric_definitions (nutricionista_id, key, name) values ('${A}', 'extra', 'x') on conflict (nutricionista_id, key) do nothing`)).rejects.toMatchObject({ code: '42501' })
    })
  })
})

describe('la migración no cambia nada más', () => {
  it('con datos previos: mismas filas, mismas políticas, restricciones y relaciones; solo cambia el índice', async () => {
    const db = await baseConMigracion0066()
    try {
      // Datos como los de antes del arreglo: estándar creadas a mano (un insert normal sí funciona con el parcial) y propias.
      await db.exec(`insert into public.metric_definitions (nutricionista_id, key, name, unit, sort_order) values ('${A}', 'waist_cm', 'Cintura', 'cm', 0), ('${A}', 'hip_cm', 'Cadera', 'cm', 1), ('${B}', 'waist_cm', 'Cintura', 'cm', 0)`)
      await db.exec(`insert into public.metric_definitions (nutricionista_id, name) values ('${A}', 'Propia 1'), ('${A}', 'Propia 2')`)
      const idMetrica = (await db.query<{ id: string }>(`select id from public.metric_definitions where key = 'waist_cm' and nutricionista_id = '${A}'`)).rows[0].id
      await db.exec(`insert into public.body_metrics (client_id, metric_id, date, value) values ('${CLIENTE_A}', '${idMetrica}', '2026-11-01', 82.5)`)

      const filasAntes = (await db.query(`select * from public.metric_definitions order by id`)).rows
      const valoresAntes = (await db.query(`select * from public.body_metrics order by id`)).rows
      const [polAntes, resAntes, ixAntes] = [await politicas(db), await restricciones(db), await indices(db)]

      await db.exec(migration('0073'))

      expect((await db.query(`select * from public.metric_definitions order by id`)).rows).toEqual(filasAntes)
      expect((await db.query(`select * from public.body_metrics order by id`)).rows).toEqual(valoresAntes)
      expect(await politicas(db)).toEqual(polAntes)
      expect(await restricciones(db)).toEqual(resAntes)
      const ixDespues = await indices(db)
      const nombres = (l: { indexname: string }[]) => l.map(i => i.indexname)
      expect(nombres(ixAntes).filter(n => !nombres(ixDespues).includes(n))).toEqual(['uq_metric_definitions_key'])
      expect(nombres(ixDespues).filter(n => !nombres(ixAntes).includes(n))).toEqual(['uq_metric_definitions_nutricionista_key'])

      // la relación sigue en pie: borrar la métrica borra sus valores (ON DELETE CASCADE)
      await db.exec(`delete from public.metric_definitions where id = '${idMetrica}'`)
      expect((await db.query(`select * from public.body_metrics`)).rows).toHaveLength(0)
    } finally { await db.close() }
  }, 60_000)

  it('sobre datos ya existentes con estándar parciales, la siembra posterior rellena solo las que faltan', async () => {
    const db = await baseConMigracion0066()
    try {
      await db.exec(`insert into public.metric_definitions (nutricionista_id, key, name, unit, sort_order) values ('${A}', 'waist_cm', 'Cintura', 'cm', 0)`)
      await db.exec(migration('0073'))
      expect(await sembrarEstandar(db, A)).toBe(STANDARD_METRICS.length - 1)
      expect(await contar(db, `nutricionista_id = '${A}'`)).toBe(STANDARD_METRICS.length)
    } finally { await db.close() }
  }, 60_000)
})
