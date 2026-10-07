import { describe, it, expect } from 'vitest'
import { LEGAL_ENTITY, LEGAL_REVIEWED } from './entity'
import { LEGAL_DOCUMENTS, fillTemplate, isLegalSlug, pendingItems, placeholdersIn } from './documents'
import { parseMarkdown } from '../lib/miniMarkdown'

// Todo el código de la app, como texto: sirve para comprobar que lo que dicen los textos legales es lo que hace la app.
const sources = import.meta.glob('../**/*.{ts,tsx,css,html}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const appCode = Object.entries(sources).filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.includes('/legal/'))
const codeContaining = (needle: string) => appCode.filter(([, text]) => text.includes(needle)).map(([path]) => path)

const doc = (slug: string) => LEGAL_DOCUMENTS.find(d => d.slug === slug)!.raw
const filled = (slug: string) => fillTemplate(doc(slug))

describe('textos legales: estructura', () => {
  it('has the six documents, with unique slugs', () => {
    expect(LEGAL_DOCUMENTS.map(d => d.slug).sort()).toEqual(['aviso', 'clientes', 'cookies', 'encargado', 'privacidad', 'terminos'])
    expect(isLegalSlug('privacidad')).toBe(true)
    expect(isLegalSlug('__proto__')).toBe(false)
    expect(isLegalSlug(null)).toBe(false)
  })

  it('every document starts with a title and has several sections', () => {
    for (const d of LEGAL_DOCUMENTS) {
      const blocks = parseMarkdown(d.raw)
      expect(blocks[0].type, d.slug).toBe('h1')
      expect(blocks.filter(b => b.type === 'h2').length, d.slug).toBeGreaterThanOrEqual(3)
    }
  })

  it('every {{key}} a text uses is defined in the entity data, and none stays unfilled', () => {
    for (const d of LEGAL_DOCUMENTS) {
      for (const key of placeholdersIn(d.raw)) expect(LEGAL_ENTITY, `${d.slug}: {{${key}}}`).toHaveProperty(key)
      expect(fillTemplate(d.raw), d.slug).not.toContain('{{')
    }
  })

  it('internal links point to documents that exist', () => {
    for (const d of LEGAL_DOCUMENTS) {
      for (const m of d.raw.matchAll(/\(\/\?legal=([a-z]+)\)/g)) expect(isLegalSlug(m[1]), `${d.slug} → ${m[1]}`).toBe(true)
    }
  })

  it('does not go live while there are pending data: the review flag and the placeholders go together', () => {
    const pending = LEGAL_DOCUMENTS.flatMap(d => pendingItems(fillTemplate(d.raw)))
    // Cuando LEGAL_REVIEWED sea true, no puede quedar nada por rellenar.
    if (LEGAL_REVIEWED) expect(pending).toEqual([])
  })
})

describe('contrato de encargado del tratamiento (art. 28 RGPD)', () => {
  const text = filled('encargado')
  it.each([
    ['instrucciones documentadas del responsable', 'instrucciones documentadas'],
    ['confidencialidad del personal', 'confidencialidad'],
    ['medidas de seguridad del art. 32', 'artículo 32'],
    ['condiciones para los subencargados', 'subencargados'],
    ['asistencia en derechos de las personas', 'derechos'],
    ['notificación de brechas con plazo', '48 horas'],
    ['auditorías y demostración del cumplimiento', 'auditorías'],
    ['devolución y supresión al terminar', 'suprimirá'],
    ['datos de salud (categoría especial)', 'datos de salud'],
  ])('covers %s', (_label, needle) => {
    expect(text.toLowerCase()).toContain(needle.toLowerCase())
  })

  it('lists the real subprocessors and where the data is stored', () => {
    expect(text).toContain('Supabase')
    expect(text).toContain('Vercel')
    expect(text).toContain('Irlanda')
  })

  it('is consistent with the app: the data really is hosted with Supabase in the EU, and the app stores files privately', () => {
    expect(codeContaining('.supabase.co').length).toBeGreaterThan(0)
    expect(codeContaining('createSignedUrl').length).toBeGreaterThan(0)   // fotos y analíticas por enlace temporal firmado
  })
})

describe('los textos dicen lo que hace la app', () => {
  it('no tracking, analytics or Google Fonts anywhere in the code (the privacy and cookies texts say there are none)', () => {
    for (const needle of ['fonts.googleapis', 'fonts.gstatic', 'google-analytics', 'googletagmanager', 'gtag(', 'plausible', 'posthog', 'hotjar', 'mixpanel', 'connect.facebook']) {
      expect(codeContaining(needle), needle).toEqual([])
    }
  })

  it('the only third-party request the code makes is the Open Food Facts lookup (which the texts disclose)', () => {
    const hosts = new Set<string>()
    for (const [, text] of appCode) for (const m of text.matchAll(/fetch\(\s*[`'"]https:\/\/([a-z0-9.-]+)/g)) hosts.add(m[1])
    expect([...hosts]).toEqual(['world.openfoodfacts.org'])
    expect(filled('privacidad')).toContain('Open Food Facts')
    expect(filled('clientes')).toContain('Open Food Facts')
  })

  it('every storage key the cookies text lists exists in the code', () => {
    for (const key of ['sb-', 'nutrifit.clientToken', 'nf_dark_mode', 'diet-option-choice', 'diet-day-type', 'nutrifit.dietAdjustment.dismissed', 'nutrifit_install_banner_seen', 'nutrifit-onboarding-skipped']) {
      expect(filled('cookies'), key).toContain(key)
      if (key !== 'sb-') expect(codeContaining(key).length, key).toBeGreaterThan(0)
    }
  })

  it('no new file starts using local storage without the cookies text being reviewed', () => {
    // Cualquier `.setItem(` (localStorage, sessionStorage o un almacén que se le pasa) del código de la app.
    const writers = appCode.filter(([, text]) => /\.setItem\(/.test(text)).map(([path]) => path.replace(/^\.\.\//, '')).sort()
    expect(writers).toEqual([
      'components/shared/InstallBanner.tsx',
      'components/trainer/PersonalOnboarding.tsx',
      'components/trainer/client-panel/DietAdjustmentCard.tsx',
      'lib/clientApp.ts',
      'lib/planMeals.ts',
      'lib/useDarkMode.ts',
    ])
  })

  it('the privacy text covers the rights and the supervisory authority', () => {
    const t = filled('privacidad')
    for (const needle of ['acceder', 'rectificar', 'suprimir', 'portabilidad', 'Agencia Española de Protección de Datos', 'art. 6.1.b']) expect(t).toContain(needle)
  })

  it('the client information says who the controller is and that data is not sold', () => {
    const t = filled('clientes')
    expect(t).toContain('es el responsable')
    expect(t).toContain('encargado del tratamiento')
    expect(t).toMatch(/no vendemos tus datos/i)
  })
})
