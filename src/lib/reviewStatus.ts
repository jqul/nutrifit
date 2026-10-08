// Estado de revisión de una ficha: cuándo la miró el nutricionista por última vez.

/** "Revisado hoy", "Revisado ayer", "Revisado hace 5 días" o "Todavía sin revisar". */
export function reviewLabel(lastReviewedAt: string | null, now: Date = new Date()): string {
  if (!lastReviewedAt) return 'Todavía sin revisar'
  const reviewed = new Date(lastReviewedAt)
  if (Number.isNaN(reviewed.getTime())) return 'Todavía sin revisar'
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((day(now) - day(reviewed)) / 86400000)
  if (days <= 0) return 'Revisado hoy'
  if (days === 1) return 'Revisado ayer'
  return `Revisado hace ${days} días`
}
