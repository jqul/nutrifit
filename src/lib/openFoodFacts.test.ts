import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupBarcode, lookupBarcodeDetailed } from './openFoodFacts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const mockFetch = (impl: () => Promise<Response>) => vi.stubGlobal('fetch', vi.fn(impl))
afterEach(() => vi.unstubAllGlobals())

// Respuesta real (recortada) de OpenFoodFacts para la Nutella
const NUTELLA = { status: 1, product: { product_name: 'Nutella', nutriments: {
  'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0, sugars_100g: 56.3, sodium_100g: 0.0428, 'saturated-fat_100g': 10.6, calcium_100g: 0.1 } } }

describe('lookupBarcodeDetailed', () => {
  it('turns an OpenFoodFacts product into a food per 100 g', async () => {
    mockFetch(async () => json(NUTELLA))
    const r = await lookupBarcodeDetailed('3017620422003')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.food).toMatchObject({ name: 'Nutella', kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, sugarG: 56.3, saturatedFatG: 10.6 })
  })

  it('converts sodium and calcium from grams to milligrams', async () => {
    mockFetch(async () => json(NUTELLA))
    const r = await lookupBarcodeDetailed('3017620422003')
    if (r.ok) { expect(r.food.sodiumMg).toBe(43); expect(r.food.calciumMg).toBe(100) }
  })

  it('falls back to energy in kJ when there is no kcal value', async () => {
    mockFetch(async () => json({ status: 1, product: { product_name: 'X', nutriments: { energy_100g: 1000 } } }))
    const r = await lookupBarcodeDetailed('1')
    if (r.ok) expect(r.food.kcal).toBe(239)
    else expect.fail('debería haberlo encontrado')
  })

  it('names a product with no name after its code', async () => {
    mockFetch(async () => json({ status: 1, product: { nutriments: { 'energy-kcal_100g': 100 } } }))
    const r = await lookupBarcodeDetailed('8412345678905')
    if (r.ok) expect(r.food.name).toBe('Producto 8412345678905')
  })

  it('says "not found" for a code that is not in the database (404 or status 0)', async () => {
    mockFetch(async () => json({ status: 0 }, 404))
    expect(await lookupBarcodeDetailed('0000000000000')).toEqual({ ok: false, reason: 'not_found' })
    mockFetch(async () => json({ status: 0, status_verbose: 'product not found' }))
    expect(await lookupBarcodeDetailed('0000000000000')).toEqual({ ok: false, reason: 'not_found' })
  })

  it('says "no nutrition data" for a product that exists but has none', async () => {
    mockFetch(async () => json({ status: 1, product: { product_name: 'Cosa', nutriments: {} } }))
    expect(await lookupBarcodeDetailed('1')).toEqual({ ok: false, reason: 'no_nutrition' })
  })

  it('says "network" when the request fails, instead of throwing (the scanner hung on "Buscando…")', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch') })
    expect(await lookupBarcodeDetailed('1')).toEqual({ ok: false, reason: 'network' })
  })

  it('says "network" for a server error, which says nothing about the product', async () => {
    mockFetch(async () => json({}, 503))
    expect(await lookupBarcodeDetailed('1')).toEqual({ ok: false, reason: 'network' })
  })

  it('says "network" for a response that is not JSON', async () => {
    mockFetch(async () => new Response('<html>mantenimiento</html>', { status: 200 }))
    expect(await lookupBarcodeDetailed('1')).toEqual({ ok: false, reason: 'network' })
  })

  it('escapes the code it sends', async () => {
    const f = vi.fn(async () => json({ status: 0 }, 404))
    vi.stubGlobal('fetch', f)
    await lookupBarcodeDetailed('../x?y=1')
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain(encodeURIComponent('../x?y=1'))
  })
})

describe('lookupBarcode (compatibility)', () => {
  it('returns the food, or null for any failure', async () => {
    mockFetch(async () => json(NUTELLA))
    expect((await lookupBarcode('3017620422003'))?.name).toBe('Nutella')
    mockFetch(async () => { throw new Error('offline') })
    expect(await lookupBarcode('3017620422003')).toBeNull()
  })
})

import { scannedFoodNote, scannedMacros } from './openFoodFacts'

describe('scannedMacros / scannedFoodNote', () => {
  const nutella = { name: 'Nutella', kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: null, sugarG: null, sodiumMg: null, saturatedFatG: null, calciumMg: null, ironMg: null, zincMg: null }
  it('scales the per-100 g values to the amount eaten', () => {
    expect(scannedMacros(nutella, 100)).toEqual({ kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 })
    expect(scannedMacros(nutella, 30)).toEqual({ kcal: 162, proteinG: 1.9, carbsG: 17.3, fatG: 9.3 })
    expect(scannedMacros(nutella, 0)).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
  it('writes the diary note with the amount and its macros', () => {
    expect(scannedFoodNote(nutella, 30)).toBe('30 g · 162 kcal · P 1,9 g · C 17,3 g · G 9,3 g (producto escaneado, Open Food Facts)')
  })
})
