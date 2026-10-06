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

/** Manifiesto de la app para UN cliente: igual que el general, pero se abre en su enlace. */
export function buildClientManifest(origin: string, token: string) {
  const start = `${origin}/?c=${token}`
  return {
    name: 'NutriFit', short_name: 'NutriFit',
    description: 'Tu plan de dieta, tu seguimiento y tus check-ins.',
    id: start, start_url: start, scope: `${origin}/`,
    display: 'standalone', background_color: '#f3f5ee', theme_color: '#3f7d4f',
    icons: [
      { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}

/**
 * Cambia el manifiesto de la página por el de este cliente. Devuelve la función que
 * lo deja como estaba. Si no se puede (sin DOM, token raro), no hace nada.
 */
export function installClientManifest(token: string): () => void {
  if (typeof document === 'undefined' || !isValidClientToken(token)) return () => {}
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  const created = !link
  if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link) }
  const previous = link.getAttribute('href')
  const url = URL.createObjectURL(new Blob([JSON.stringify(buildClientManifest(window.location.origin, token))], { type: 'application/manifest+json' }))
  link.setAttribute('href', url)
  return () => {
    URL.revokeObjectURL(url)
    if (created) link?.remove()
    else if (previous != null) link?.setAttribute('href', previous)
  }
}
