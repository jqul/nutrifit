// Texto de "última edición" de las notas privadas del cliente (UX-37).

/** "Última edición: 3 oct 2026, 18:40", o un aviso si no hay fecha. */
export function formatNotesEdited(updatedAt: number | null | undefined, hasNotes: boolean): string {
  if (updatedAt == null) return hasNotes ? 'Última edición: sin fecha registrada' : 'Todavía no has escrito ninguna nota'
  const d = new Date(updatedAt)
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `Última edición: ${date}, ${time}`
}
