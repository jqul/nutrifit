// Subir el número purga las cachés anteriores al activarse (ver 'activate'): sirve para limpiar una caché envenenada.
const CACHE = 'nutrifit-v2'
const STATIC = [
  '/',
  '/index.html',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Solo cachear GET, ignorar Supabase y otros APIs externos
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.hostname !== location.hostname) return

  // Si lo que se pide es un fichero (estilos, scripts, imágenes…) y llega una página HTML, no es ese fichero: es la
  // página de respaldo de la SPA para una ruta que ya no existe (p. ej. un .css con hash de un despliegue anterior).
  // Darlo por bueno —o guardarlo— deja la app sin estilos; mejor lo que hubiera en caché, o un error limpio.
  const wantsFile = ['style', 'script', 'font', 'image', 'manifest'].includes(e.request.destination)

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (wantsFile && (res.headers.get('content-type') || '').includes('text/html')) {
          return caches.match(e.request).then(cached => cached || Response.error())
        }
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      // Sin red: lo cacheado si existe. El respaldo a index.html es solo para
      // navegaciones (recargar una ruta de la SPA) — si falla un .js/.css y se
      // devolviera HTML, el navegador lo intentaría ejecutar y daría error de MIME.
      .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  )
})

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch {}
  const title = data.title || 'NutriFit'
  const options = {
    body: data.body || '',
    data: { url: data.url || '/' },
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const existing = clientsArr.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
