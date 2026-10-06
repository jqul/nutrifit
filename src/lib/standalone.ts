/** ¿Está la web abierta como app instalada (icono en la pantalla de inicio) y no en una pestaña del navegador? */
export function isStandalone(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari no tiene display-mode: standalone — expone su propio flag.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}
