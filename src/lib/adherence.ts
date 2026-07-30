import { DailyCheckin } from '../types'

// Formato de fecha local (no UTC) — usar toISOString() aquí desplazaría el día
// según la zona horaria del usuario.
function toDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function calcAdherence(checkins: DailyCheckin[], days = 7, referenceDate = new Date()): number {
  if (days <= 0) return 0
  const byDate = new Map(checkins.map(c => [c.date, c]))
  let adherent = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(referenceDate)
    d.setDate(d.getDate() - i)
    const checkin = byDate.get(toDateOnly(d))
    if (checkin && checkin.followedPlan !== 'no') adherent++
  }
  return Math.round((adherent / days) * 100)
}

export function calcStreak(checkins: DailyCheckin[], referenceDate = new Date()): number {
  const dates = new Set(checkins.map(c => c.date))
  let streak = 0
  const cursor = new Date(referenceDate)
  while (dates.has(toDateOnly(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
