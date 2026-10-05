import { describe, it, expect } from 'vitest'
import { ClientData } from '../types'
import { EXPORT_EXCLUDED, EXPORT_TABLES, ExportSource, collectClientExport } from './clientExport'

const client = { id: 'c1', name: 'María', surname: 'Torres' } as unknown as ClientData

type Row = Record<string, unknown>
/** Una base de datos falsa: tablas en memoria; registra qué se pidió. */
function fakeSource(tables: Record<string, Row[]>, opts: { failTable?: string; failSigning?: boolean } = {}) {
  const asked: string[] = []
  const src: ExportSource = {
    async rows(table, column, values) {
      asked.push(table)
      if (table === opts.failTable) throw new Error('boom')
      return (tables[table] ?? []).filter(r => values.includes(String(r[column])))
    },
    async signedUrls(bucket, paths) {
      if (opts.failSigning) throw new Error('sign')
      return paths.map(path => ({ path, signedUrl: path.includes('missing') ? null : `https://signed/${bucket}/${path}` }))
    },
  }
  return { src, asked }
}

describe('collectClientExport', () => {
  it('asks for every table that holds client data', async () => {
    const { src, asked } = fakeSource({})
    await collectClientExport(client, src)
    for (const { table } of EXPORT_TABLES) expect(asked).toContain(table)
  })

  it('keeps only the rows of this client', async () => {
    const { src } = fakeSource({
      weight_logs: [{ id: 'w1', client_id: 'c1', weight_kg: 70 }, { id: 'w2', client_id: 'otro', weight_kg: 99 }],
    })
    const bundle = await collectClientExport(client, src)
    expect(bundle.datos.weight_logs).toEqual([{ id: 'w1', client_id: 'c1', weight_kg: 70 }])
  })

  it('nests meals, foods and supplements under their plan', async () => {
    const { src } = fakeSource({
      diet_plans: [{ id: 'p1', client_id: 'c1', kcal_target: 1800 }],
      diet_meals: [{ id: 'm1', plan_id: 'p1', name: 'Desayuno', sort_order: 0 }, { id: 'mx', plan_id: 'plan-ajeno', name: 'X', sort_order: 0 }],
      diet_meal_items: [{ id: 'i1', meal_id: 'm1', food_name: 'Avena' }, { id: 'ix', meal_id: 'mx', food_name: 'Ajeno' }],
      diet_supplements: [{ id: 's1', plan_id: 'p1', name: 'Creatina' }],
    })
    const bundle = await collectClientExport(client, src)
    expect(bundle.planesDeDieta).toHaveLength(1)
    const plan = bundle.planesDeDieta[0]
    expect(plan.comidas).toHaveLength(1)
    expect((plan.comidas[0] as Row).alimentos).toEqual([{ id: 'i1', meal_id: 'm1', food_name: 'Avena' }])
    expect(plan.suplementos).toEqual([{ id: 's1', plan_id: 'p1', name: 'Creatina' }])
  })

  it('includes the definition of the surveys the client answered', async () => {
    const { src } = fakeSource({
      survey_responses: [{ id: 'r1', client_id: 'c1', survey_id: 'sv1', answers: {} }],
      custom_surveys: [{ id: 'sv1', name: 'Revisión mensual' }, { id: 'sv2', name: 'No contestada' }],
    })
    const bundle = await collectClientExport(client, src)
    expect(bundle.encuestas).toEqual([{ id: 'sv1', name: 'Revisión mensual' }])
  })

  it('lists photos, meal photos and lab PDFs with temporary links, labelled', async () => {
    const { src } = fakeSource({
      progress_photos: [{ id: 'ph1', client_id: 'c1', date: '2026-09-30', front_url: 'c1/s1/front.jpg', side_url: null, back_url: '' }],
      meal_logs: [{ id: 'ml1', client_id: 'c1', date: '2026-10-01', meal_name: 'Comida', photo_url: 'c1/meals/1.jpg' }, { id: 'ml2', client_id: 'c1', date: '2026-10-02', meal_name: 'Cena', photo_url: null }],
      lab_reports: [{ id: 'lr1', client_id: 'c1', date: '2026-09-15', file_path: 'c1/2026-09-15.pdf' }],
    })
    const { archivos } = await collectClientExport(client, src)
    expect(archivos.map(a => `${a.bucket}:${a.path}`).sort()).toEqual(['lab-reports:c1/2026-09-15.pdf', 'photos:c1/meals/1.jpg', 'photos:c1/s1/front.jpg'])
    expect(archivos.find(a => a.path === 'c1/s1/front.jpg')).toMatchObject({ tipo: 'foto de progreso (frontal) 2026-09-30', enlace: 'https://signed/photos/c1/s1/front.jpg' })
    expect(archivos.find(a => a.path === 'c1/2026-09-15.pdf')?.tipo).toBe('informe de analítica 2026-09-15')
  })

  it('understands legacy rows that stored a full public URL', async () => {
    const { src } = fakeSource({
      progress_photos: [{ id: 'ph1', client_id: 'c1', date: '2026-01-01', front_url: 'https://p.supabase.co/storage/v1/object/public/photos/c1/old.jpg' }],
    })
    expect((await collectClientExport(client, src)).archivos[0].path).toBe('c1/old.jpg')
  })

  it('keeps a file whose link could not be signed, marking it with a null link', async () => {
    const { src } = fakeSource({ meal_logs: [{ id: 'ml1', client_id: 'c1', date: '2026-10-01', meal_name: 'Comida', photo_url: 'c1/missing.jpg' }] })
    expect((await collectClientExport(client, src)).archivos[0].enlace).toBeNull()
  })

  it('FAILS instead of handing over an incomplete export when a table cannot be read', async () => {
    const { src } = fakeSource({}, { failTable: 'blood_markers' })
    await expect(collectClientExport(client, src)).rejects.toThrow(/blood_markers/)
  })

  it('fails too when the file links cannot be created', async () => {
    const { src } = fakeSource({ meal_logs: [{ id: 'ml1', client_id: 'c1', date: 'd', meal_name: 'm', photo_url: 'c1/a.jpg' }] }, { failSigning: true })
    await expect(collectClientExport(client, src)).rejects.toThrow(/enlaces/)
  })

  it('says what is left out and why, and when the export was made', async () => {
    const { src } = fakeSource({})
    const bundle = await collectClientExport(client, src, new Date('2026-10-05T10:00:00Z'))
    expect(bundle.noIncluido).toEqual(EXPORT_EXCLUDED)
    expect(bundle.exportedAt).toBe('2026-10-05T10:00:00.000Z')
    expect(bundle.client).toBe(client)
  })
})

// ── Guardia: una tabla nueva con datos del cliente no puede quedarse fuera sin decidirlo ──
const migrations = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function tablesWithClientId(): string[] {
  const found = new Set<string>()
  for (const sql of Object.values(migrations)) {
    // create table [if not exists] [public.]nombre ( ... ) — se mira si el cuerpo menciona client_id
    for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      if (/\bclient_id\b/.test(m[2])) found.add(m[1])
    }
  }
  return [...found].sort()
}

describe('cobertura de la exportación', () => {
  const known = new Set([...EXPORT_TABLES.map(t => t.table), ...Object.keys(EXPORT_EXCLUDED)])

  it('cada tabla con client_id de las migraciones se exporta o se excluye a propósito', () => {
    const missing = tablesWithClientId().filter(t => !known.has(t))
    expect(missing, `Tablas con datos del cliente sin decidir si se exportan: ${missing.join(', ')}. Añádelas a EXPORT_TABLES o a EXPORT_EXCLUDED en src/lib/clientExport.ts`).toEqual([])
  })

  it('no se exporta ninguna tabla que no exista (erratas)', () => {
    const real = new Set(tablesWithClientId())
    const unknown = [...known].filter(t => !real.has(t))
    expect(unknown).toEqual([])
  })
})
