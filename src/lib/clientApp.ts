// La app del cliente se abre con su enlace personal (/?c=<token>). Al guardar esa
// página como acceso directo / instalarla en el móvil, el icono tiene que volver a
// abrir ESE enlace; si no, abre la raíz "/" y el cliente se encuentra la pantalla
// de acceso de los nutricionistas (el fallo que motivó este fichero).
//
// Se resuelve de dos formas:
//  · Un manifiesto PROPIO de cada cliente, cuyo start_url es su enlace: lo usa el
//    navegador al instalar o añadir a la pantalla de inicio.
//  · El token se recuerda en el dispositivo: si la app instalada se abre sin enlace
//    (accesos directos creados antes de este arreglo), vuelve a la app del cliente
//    en vez de a la de nutricionistas.

export const CLIENT_TOKEN_KEY = 'nutrifit.clientToken'

/** Los tokens son hexadecimal (generateClientToken) o 'demo-token-…'; nada que pueda romper una URL ni un JSON. */
export const isValidClientToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(t)

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const defaultStore = (): Store | null => { try { return globalThis.localStorage ?? null } catch { return null } }

export function rememberClientToken(token: string, store: Store | null = defaultStore()): void {
  if (!isValidClientToken(token) || token.startsWith('demo-token-')) return
  try { store?.setItem(CLIENT_TOKEN_KEY, token) } catch { /* sin almacenamiento: se pierde solo el atajo */ }
}

export function readRememberedClientToken(store: Store | null = defaultStore()): string | null {
  try {
    const t = store?.getItem(CLIENT_TOKEN_KEY)
    return isValidClientToken(t) ? t : null
  } catch { return null }
}

export function forgetClientToken(store: Store | null = defaultStore()): void {
  try { store?.removeItem(CLIENT_TOKEN_KEY) } catch { /* nada que hacer */ }
}

/**
 * El token de la ficha del usuario con sesión (RPC get_my_client_token), o null si no es un cliente.
 * `failed` distingue "no es cliente" de "no se ha podido comprobar": en el segundo caso NO hay que
 * cerrarle la sesión a nadie.
 */
export async function fetchMyClientToken(rpc: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<{ token: string | null; failed: boolean }> {
  try {
    const { data, error } = await rpc()
    if (error) return { token: null, failed: true }
    return { token: isValidClientToken(data) ? data : null, failed: false }
  } catch {
    return { token: null, failed: true }
  }
}

export type NonTrainerOutcome =
  | { kind: 'client'; token: string }   // es un cliente: a su app, con la sesión intacta
  | { kind: 'keep-session' }            // no se ha podido comprobar: no se cierra la sesión de nadie
  | { kind: 'remembered' }              // no es cliente, pero hay un enlace recordado en la app instalada
  | { kind: 'sign-out' }                // no es de nadie: se cierra la sesión (como siempre)

/**
 * Qué hacer con una sesión que NO es de un nutricionista. Antes: cerrarla siempre, lo que obligaba a un cliente
 * que abría "/" a escribir su correo y contraseña cada vez.
 */
export async function decideForNonTrainerSession(
  rpc: () => PromiseLike<{ data: unknown; error: unknown }>, hasRememberedClient: boolean,
): Promise<NonTrainerOutcome> {
  const mine = await fetchMyClientToken(rpc)
  if (mine.token) return { kind: 'client', token: mine.token }
  if (mine.failed) return { kind: 'keep-session' }
  return hasRememberedClient ? { kind: 'remembered' } : { kind: 'sign-out' }
}

export const MAX_APP_NAME_LENGTH = 24

/** El nombre que el nutricionista le pone a la app de sus clientes: sin espacios de más y de 24 letras como mucho; vacío = sin nombre propio. */
export function cleanAppName(raw: string | null | undefined): string | null {
  const name = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_APP_NAME_LENGTH).trim()
  return name || null
}

/** El nombre corto que se ve bajo el icono (los móviles cortan hacia las 12 letras): se recorta por una palabra entera si se puede. */
export function shortAppName(name: string): string {
  if (name.length <= 12) return name
  const words = name.split(' ')
  let out = words[0]
  for (const w of words.slice(1)) { if ((out + ' ' + w).length > 12) break; out += ' ' + w }
  return out.length >= 3 && out.length <= 12 ? out : name.slice(0, 12).trim()
}

/** Las pestañas de la app del cliente. */
export type ClientTab = 'hoy' | 'dieta' | 'progreso' | 'mas'
const CLIENT_TABS: readonly ClientTab[] = ['hoy', 'dieta', 'progreso', 'mas']

/** La pestaña pedida en el enlace (`?t=dieta`), o null si no hay o no es una de las cuatro. */
export function tabFromSearch(search: string): ClientTab | null {
  const t = new URLSearchParams(search).get('t')
  return CLIENT_TABS.find(x => x === t) ?? null
}

/**
 * Atajos al mantener pulsado el icono de la app instalada (Android/Chrome; iOS los ignora): cada uno abre la app del cliente
 * directamente en su pestaña. Máximo 4: es lo que muestran los móviles.
 */
export const CLIENT_SHORTCUTS: readonly { name: string; short_name: string; tab: ClientTab }[] = [
  { name: 'Mi plan de hoy', short_name: 'Mi plan', tab: 'dieta' },
  { name: 'Registrar mi peso', short_name: 'Mi peso', tab: 'progreso' },
  { name: 'Mi check-in de hoy', short_name: 'Check-in', tab: 'hoy' },
]

/** Manifiesto de la app para UN cliente: igual que el general, pero se abre en su enlace y lleva el nombre de la app del nutricionista. */
export function buildClientManifest(origin: string, token: string, appName?: string | null) {
  const start = `${origin}/?c=${token}`
  const name = cleanAppName(appName)
  return {
    name: name ?? 'NutriFit', short_name: name ? shortAppName(name) : 'NutriFit',
    description: 'Tu plan de dieta, tu seguimiento y tus check-ins.',
    id: start, start_url: start, scope: `${origin}/`,
    display: 'standalone', background_color: '#f3f5ee', theme_color: '#3f7d4f',
    icons: [
      { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: CLIENT_SHORTCUTS.map(s => ({
      name: s.name, short_name: s.short_name, url: `${start}&t=${s.tab}`,
      icons: [{ src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png' }],
    })),
  }
}

/**
 * Cambia el manifiesto de la página por el de este cliente. Devuelve la función que
 * lo deja como estaba. Si no se puede (sin DOM, token raro), no hace nada.
 */
export function installClientManifest(token: string, appName?: string | null): () => void {
  if (typeof document === 'undefined' || !isValidClientToken(token)) return () => {}
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  const created = !link
  if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link) }
  const previous = link.getAttribute('href')
  const url = URL.createObjectURL(new Blob([JSON.stringify(buildClientManifest(window.location.origin, token, appName))], { type: 'application/manifest+json' }))
  link.setAttribute('href', url)
  return () => {
    URL.revokeObjectURL(url)
    if (created) link?.remove()
    else if (previous != null) link?.setAttribute('href', previous)
  }
}

/** Dónde se dibuja un logo de `w` × `h` dentro de un cuadrado de `size`, entero (sin recortar) y centrado, con un margen. */
export function containRect(w: number, h: number, size: number, padding = 0.14): { x: number; y: number; width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { x: 0, y: 0, width: size, height: size }
  const inner = size * (1 - 2 * padding)
  const scale = Math.min(inner / w, inner / h)
  const width = w * scale, height = h * scale
  return { x: (size - width) / 2, y: (size - height) / 2, width, height }
}

/**
 * El logo del nutricionista como un icono cuadrado (PNG en data: URL), con su color de fondo: es lo que iOS usa al añadir la app a
 * la pantalla de inicio. Devuelve null si no se puede (sin DOM, imagen que no carga o que el navegador no deja leer).
 */
export function squareIconDataUrl(logoUrl: string, size = 180, background: string | null = null): Promise<string | null> {
  if (typeof document === 'undefined' || !/^https?:\/\//i.test(logoUrl)) return Promise.resolve(null)
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.fillStyle = background && /^#[0-9a-fA-F]{3,8}$/.test(background) ? background : '#ffffff'
        ctx.fillRect(0, 0, size, size)
        const r = containRect(img.naturalWidth, img.naturalHeight, size)
        ctx.drawImage(img, r.x, r.y, r.width, r.height)
        resolve(canvas.toDataURL('image/png'))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = logoUrl
  })
}

/**
 * Pone la identidad de la app del nutricionista en la página del cliente: el nombre (pestaña y título al añadirla a la pantalla de
 * inicio en iOS) y, si se puede, su logo como icono de iOS. Devuelve la función que lo deja como estaba.
 */
export function applyAppIdentity(opts: { appName?: string | null; logoUrl?: string | null; accentColor?: string | null }): () => void {
  if (typeof document === 'undefined') return () => {}
  const restores: (() => void)[] = []
  let cancelled = false
  const name = cleanAppName(opts.appName)
  if (name) {
    const prevTitle = document.title
    document.title = name
    restores.push(() => { document.title = prevTitle })
    const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    if (meta) {
      const prev = meta.getAttribute('content')
      meta.setAttribute('content', name)
      restores.push(() => meta.setAttribute('content', prev ?? 'NutriFit'))
    }
  }
  const link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (link && opts.logoUrl) {
    const prev = link.getAttribute('href')
    squareIconDataUrl(opts.logoUrl, 180, opts.accentColor ?? null).then(url => { if (!cancelled && url) link.setAttribute('href', url) })
    restores.push(() => { if (prev != null) link.setAttribute('href', prev) })
  }
  return () => { cancelled = true; restores.forEach(r => r()) }
}
