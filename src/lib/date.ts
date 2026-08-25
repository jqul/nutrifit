// Fecha local en formato YYYY-MM-DD — usar toISOString() aquí desplaza el día
// según la zona horaria del usuario (bug conocido, ver adherence.ts).
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 0=lunes...6=domingo, para que coincida con dayOfWeek en diet_meals — JS
// Date.getDay() es 0=domingo...6=sábado, de ahí el desplazamiento.
export function todayDayOfWeek(): number { return (new Date().getDay() + 6) % 7 }
