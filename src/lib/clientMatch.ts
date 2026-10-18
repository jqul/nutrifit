// Emparejar una fila de una hoja de cálculo con un cliente que ya existe (o que se va a crear): por email, por teléfono o por
// nombre. Cuando hay duda (varios clientes con el mismo nombre) no se adivina: se explica qué hace falta para decidir.
import { stripAccents } from './spreadsheet'

export interface ImportClient { id: string; name: string; surname: string; email: string; phone: string }

/** Nombres de columna con los que se identifica al cliente en cualquier hoja de historial. */
export const CLIENT_ID_ALIASES = {
  client: ['cliente', 'nombre', 'paciente', 'nombre y apellidos', 'nombre completo', 'name', 'client'],
  surname: ['apellidos', 'apellido', 'surname', 'last name'],
  email: ['email', 'correo', 'e-mail'],
  phone: ['telefono', 'phone', 'movil'],
}

const norm = (s: string) => stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim()
const digits = (s: string) => s.replace(/\D/g, '')

export type Match = { ok: true; client: ImportClient } | { ok: false; reason: string }

export function matchClient(cell: { client: string; surname: string; email: string; phone: string }, clients: ImportClient[]): Match {
  // Si en la columna de cliente han puesto un email o un teléfono en vez de un nombre, se entiende igual.
  const email = (cell.email || (cell.client.includes('@') ? cell.client : '')).trim().toLowerCase()
  if (email) {
    const found = clients.filter(c => c.email.trim().toLowerCase() === email)
    if (found.length === 1) return { ok: true, client: found[0] }
  }
  const phone = digits(cell.phone || (/^[\d\s+()-]{6,}$/.test(cell.client.trim()) ? cell.client : ''))
  if (phone.length >= 6) {
    const found = clients.filter(c => digits(c.phone).slice(-9) === phone.slice(-9) && digits(c.phone).length >= 6)
    if (found.length === 1) return { ok: true, client: found[0] }
  }
  const given = norm(`${cell.client} ${cell.surname}`)
  if (!given) return { ok: false, reason: 'No hay cliente (ni email ni teléfono ni nombre)' }
  const exact = clients.filter(c => norm(`${c.name} ${c.surname}`) === given)
  if (exact.length === 1) return { ok: true, client: exact[0] }
  if (exact.length > 1) return { ok: false, reason: `Hay varios clientes llamados «${cell.client}»: usa su email o teléfono` }
  // Solo el nombre de pila, si es único.
  if (!cell.surname.trim()) {
    const byFirst = clients.filter(c => norm(c.name) === given)
    if (byFirst.length === 1) return { ok: true, client: byFirst[0] }
    if (byFirst.length > 1) return { ok: false, reason: `«${cell.client}» coincide con varios clientes: añade los apellidos` }
  }
  return { ok: false, reason: `No hay ningún cliente que se llame «${`${cell.client} ${cell.surname}`.trim()}»` }
}

