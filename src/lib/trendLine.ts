// Línea de tendencia suavizada para la gráfica de peso: una media móvil
// centrada, no una regresión lineal — el objetivo es limar el ruido del
// día a día (agua retenida, momento del pesaje...) sin perder la forma real
// de la evolución.
export function movingAverage(values: number[], window = 3): number[] {
  if (values.length === 0) return []
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(values.length - 1, i + half)
    const slice = values.slice(start, end + 1)
    return slice.reduce((sum, v) => sum + v, 0) / slice.length
  })
}
