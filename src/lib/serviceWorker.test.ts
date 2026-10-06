import { describe, it, expect } from 'vitest'
import swSource from '../../public/sw.js?raw'

// Carga public/sw.js tal cual, con un entorno de service worker de mentira, y prueba su caché.
function loadSw(network: (url: string) => Promise<Response>) {
  const listeners: Record<string, (e: any) => void> = {}
  const store = new Map<string, Map<string, Response>>()
  const keyOf = (r: any) => (typeof r === 'string' ? r : r.url)
  const cacheApi = (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const m = store.get(name)!
    return {
      put: async (r: any, res: Response) => { m.set(keyOf(r), res) },
      match: async (r: any) => m.get(keyOf(r)),
      addAll: async (urls: string[]) => { for (const u of urls) m.set(new URL(u, 'https://nutrifit.test').href, new Response('<html></html>', { headers: { 'content-type': 'text/html' } })) },
      keys: async () => [...m.keys()].map(url => ({ url })),
    }
  }
  const caches = {
    open: async (n: string) => cacheApi(n),
    keys: async () => [...store.keys()],
    delete: async (k: string) => store.delete(k),
    match: async (r: any) => { for (const m of store.values()) { const hit = m.get(keyOf(r)); if (hit) return hit } return undefined },
  }
  const self = {
    addEventListener: (t: string, f: (e: any) => void) => { listeners[t] = f },
    skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => [] }, registration: {},
  }
  new Function('self', 'caches', 'fetch', 'location', swSource)(self, caches, (req: any) => network(keyOf(req)), { hostname: 'nutrifit.test' })

  const fetchEvent = async (url: string, destination: string, mode = 'no-cors') => {
    let response: Promise<Response> | undefined
    listeners.fetch({ request: { method: 'GET', url, destination, mode }, respondWith: (p: Promise<Response>) => { response = p } })
    // Deja que termine el put en segundo plano
    const res = response ? await response.catch(e => e) : undefined
    await new Promise(r => setTimeout(r, 0))
    return res
  }
  return { listeners, store, caches, fetchEvent }
}

const html = () => new Response('<!doctype html><title>NutriFit</title>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
const css = () => new Response('body{color:red}', { status: 200, headers: { 'content-type': 'text/css' } })

describe('service worker', () => {
  it('uses a new cache name, so the previous one is purged when it activates', async () => {
    const { listeners, store, caches } = loadSw(async () => css())
    store.set('nutrifit-v1', new Map([['https://nutrifit.test/old', css()]]))
    let done: Promise<unknown> | undefined
    listeners.activate({ waitUntil: (p: Promise<unknown>) => { done = p } })
    await done
    expect(await caches.keys()).not.toContain('nutrifit-v1')
  })

  it('caches a real stylesheet', async () => {
    const sw = loadSw(async () => css())
    const res = await sw.fetchEvent('https://nutrifit.test/assets/index-ABC.css', 'style') as Response
    expect(res.headers.get('content-type')).toBe('text/css')
    expect(await sw.caches.match('https://nutrifit.test/assets/index-ABC.css')).toBeDefined()
  })

  it('does not take an HTML page for a stylesheet, and does not cache it (the app lost its styles)', async () => {
    // Vercel devolvía index.html con 200 para el .css con hash de un despliegue anterior
    const sw = loadSw(async () => html())
    const res = await sw.fetchEvent('https://nutrifit.test/assets/index-VIEJO.css', 'style')
    expect(res instanceof Response && res.type === 'error').toBe(true)
    expect(await sw.caches.match('https://nutrifit.test/assets/index-VIEJO.css')).toBeUndefined()
  })

  it('serves what it already had for that file instead of the HTML page', async () => {
    const sw = loadSw(async () => html())
    const cache = await sw.caches.open('nutrifit-v2')
    await cache.put('https://nutrifit.test/assets/index-ABC.css', css())
    const res = await sw.fetchEvent('https://nutrifit.test/assets/index-ABC.css', 'style') as Response
    expect(res.headers.get('content-type')).toBe('text/css')
  })

  it('the same goes for scripts', async () => {
    const sw = loadSw(async () => html())
    const res = await sw.fetchEvent('https://nutrifit.test/assets/index-VIEJO.js', 'script')
    expect(res instanceof Response && res.type === 'error').toBe(true)
  })

  it('still caches and serves normal pages (navigations are HTML on purpose)', async () => {
    const sw = loadSw(async () => html())
    const res = await sw.fetchEvent('https://nutrifit.test/?c=abc', 'document', 'navigate') as Response
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await sw.caches.match('https://nutrifit.test/?c=abc')).toBeDefined()
  })

  it('falls back to the cached page when offline', async () => {
    const sw = loadSw(async () => { throw new TypeError('offline') })
    const cache = await sw.caches.open('nutrifit-v2')
    await cache.put('https://nutrifit.test/?c=abc', html())
    const res = await sw.fetchEvent('https://nutrifit.test/?c=abc', 'document', 'navigate') as Response
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('leaves other origins and non-GET requests alone', () => {
    const sw = loadSw(async () => css())
    let responded = false
    sw.listeners.fetch({ request: { method: 'GET', url: 'https://otro.example/x.css', destination: 'style', mode: 'no-cors' }, respondWith: () => { responded = true } })
    sw.listeners.fetch({ request: { method: 'POST', url: 'https://nutrifit.test/api', destination: '', mode: 'cors' }, respondWith: () => { responded = true } })
    expect(responded).toBe(false)
  })
})
