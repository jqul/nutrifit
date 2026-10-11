// ¿Hay una versión nueva de la app? Cada despliegue genera un archivo principal con un nombre nuevo (/assets/index-AbC123.js):
// si el que dice la página que hay ahora en el servidor no es el que tenemos cargado, hay una versión nueva.
const ENTRY = /\/assets\/index-[A-Za-z0-9_-]+\.js/

/** El archivo principal que referencia una página HTML, o null si no se encuentra. */
export function entryAssetOf(html: string): string | null {
  return ENTRY.exec(html)?.[0] ?? null
}

/** Hay versión nueva solo si se conocen las dos y son distintas (ante la duda, no molestar). */
export function isNewVersion(current: string | null, latest: string | null): boolean {
  return !!current && !!latest && current !== latest
}
