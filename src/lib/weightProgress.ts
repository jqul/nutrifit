// Progreso de peso hacia una meta — misma cuenta que necesitan tanto la
// tarjeta de impacto del cliente (ProgresoClienteTab) como la ficha de
// perfil del nutricionista (PerfilTab), así que vive en un solo sitio en
// vez de recalcularse (y poder desincronizarse) en cada pantalla.
export interface WeightProgress {
  changeKg: number
  remainingKg: number | null
  progressPct: number | null
  goalReached: boolean
}

export function computeWeightProgress(initialKg: number, currentKg: number, goalKg: number | null): WeightProgress {
  const changeKg = currentKg - initialKg
  if (goalKg == null) return { changeKg, remainingKg: null, progressPct: null, goalReached: false }

  const remainingKg = Math.abs(currentKg - goalKg)
  const totalDistance = Math.abs(initialKg - goalKg)
  // "Alcanzado" el objetivo si está a menos de medio kilo, o si ya lo ha
  // superado según la dirección real del viaje (perder vs. ganar) — si no,
  // alguien que ha pasado de largo su meta de pérdida de peso vería el
  // progreso bajar de nuevo en vez de quedarse al 100%.
  const losing = goalKg < initialKg
  const passedGoal = totalDistance === 0 || (losing ? currentKg <= goalKg : currentKg >= goalKg)
  const reached = passedGoal || remainingKg < 0.5
  const progressPct = reached ? 100 : Math.max(0, ((totalDistance - remainingKg) / totalDistance) * 100)

  return { changeKg, remainingKg, progressPct, goalReached: reached }
}
