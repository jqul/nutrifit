// Importar los clientes que el nutricionista ya tenía en una hoja de cálculo (CSV o Excel): reconoce las columnas por su
// nombre, marca los que ya existen en NutriFit (para no duplicarlos) y valida los pesos.
import { detectColumns, stripAccents } from './spreadsheet'
import { parseWeightKg } from './weightInput'
import type { ImportClient } from './weightHistoryImport'

export interface ParsedClient {
  name: string; surname: string; phone: string; email: string
  goal: string; heightCm: string; gender: string; birthDate: string; allergies: string
  weightKg: string; goalWeightKg: string
  /** Notas privadas del nutricionista sobre el cliente (la pestaña Notas de su ficha; el cliente no las ve). */
  notes: string
}

// Alias de cabeceras aceptadas (sin acentos ni mayúsculas) para cada campo: admite plantillas en español o inglés.
export const CLIENT_HEADER_ALIASES: Record<keyof ParsedClient, string[]> = {
  name: ['nombre', 'name', 'first name', 'firstname'],
  surname: ['apellidos', 'apellido', 'surname', 'last name', 'lastname'],
  phone: ['telefono', 'teléfono', 'phone', 'movil', 'móvil'],
  email: ['email', 'correo', 'e-mail'],
  goal: ['objetivo', 'goal'],
  heightCm: ['altura', 'height', 'altura (cm)', 'height (cm)'],
  gender: ['genero', 'género', 'gender', 'sexo'],
  birthDate: ['nacimiento', 'fecha de nacimiento', 'birth date', 'birthdate', 'dob'],
  allergies: ['alergias', 'allergies', 'alergias / intolerancias'],
  weightKg: ['peso', 'peso actual', 'peso (kg)', 'peso actual (kg)', 'weight', 'weight (kg)'],
  goalWeightKg: ['peso objetivo', 'peso objetivo (kg)', 'peso meta', 'objetivo de peso', 'goal weight'],
  notes: ['notas', 'nota', 'observaciones', 'notas privadas', 'comentarios', 'notes'],
}

export function rowsToClients(rows: string[][]): ParsedClient[] {
  if (rows.length === 0) return []
  const [header, ...dataRows] = rows
  const cols = detectColumns(header, CLIENT_HEADER_ALIASES)
  const cell = (r: string[], i: number | undefined) => (i == null ? '' : (r[i] || '').trim())
  return dataRows
    .filter(r => r.some(c => (c || '').trim() !== ''))
    .map(r => ({
      name: cell(r, cols.name), surname: cell(r, cols.surname), phone: cell(r, cols.phone), email: cell(r, cols.email),
      goal: cell(r, cols.goal), heightCm: cell(r, cols.heightCm), gender: cell(r, cols.gender), birthDate: cell(r, cols.birthDate),
      allergies: cell(r, cols.allergies), weightKg: cell(r, cols.weightKg), goalWeightKg: cell(r, cols.goalWeightKg),
      notes: cell(r, cols.notes),
    }))
}

/** ¿Se reconoció la columna del nombre en la primera fila? Sin ella no se puede importar nada. */
export function hasNameColumn(rows: string[][]): boolean {
  return rows.length > 0 && detectColumns(rows[0], CLIENT_HEADER_ALIASES).name != null
}

const norm = (s: string) => stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim()
const digits = (s: string) => s.replace(/\D/g, '')

/** El cliente que ya existe y coincide (mismo email, mismo teléfono o mismo nombre y apellidos), o null. */
export function findExistingClient(row: Pick<ParsedClient, 'name' | 'surname' | 'email' | 'phone'>, existing: ImportClient[]): ImportClient | null {
  const email = row.email.trim().toLowerCase()
  if (email) { const m = existing.find(c => c.email.trim().toLowerCase() === email); if (m) return m }
  const phone = digits(row.phone)
  if (phone.length >= 6) { const m = existing.find(c => digits(c.phone).length >= 6 && digits(c.phone).slice(-9) === phone.slice(-9)); if (m) return m }
  const full = norm(`${row.name} ${row.surname}`)
  if (full) { const m = existing.find(c => norm(`${c.name} ${c.surname}`) === full); if (m) return m }
  return null
}

export type RowStatus = 'new' | 'exists' | 'no-name'

export interface ClientRowReview {
  row: ParsedClient
  status: RowStatus
  /** Pesos que no se han podido leer (se ignoran, el cliente se importa igualmente). */
  badWeights: string[]
}

/** Qué pasará con cada fila: se crea, ya existe (se omite) o no tiene nombre (se ignora). También avisa de pesos ilegibles. */
export function reviewClientRows(rows: ParsedClient[], existing: ImportClient[]): ClientRowReview[] {
  const seen: ImportClient[] = []   // los que ya van a crearse en este mismo archivo, para no duplicarlos entre sí
  return rows.map(row => {
    const badWeights: string[] = []
    if (parseWeightKg(row.weightKg).status === 'invalid') badWeights.push('peso')
    if (parseWeightKg(row.goalWeightKg).status === 'invalid') badWeights.push('peso objetivo')
    if (!row.name.trim()) return { row, status: 'no-name' as const, badWeights }
    const asImport: ImportClient = { id: `file-${seen.length}`, name: row.name, surname: row.surname, email: row.email, phone: row.phone }
    if (findExistingClient(row, [...existing, ...seen])) return { row, status: 'exists' as const, badWeights }
    seen.push(asImport)
    return { row, status: 'new' as const, badWeights }
  })
}

export const CLIENT_TEMPLATE = 'Nombre;Apellidos;Teléfono;Email;Objetivo;Altura (cm);Peso (kg);Peso objetivo (kg);Alergias;Notas\nLaura;Gómez;600111222;laura@correo.es;perder_peso;165;70,5;64;Lactosa;Prefiere cenar pronto\nCarlos;Ruiz;611333444;;ganar_masa;180;78;84;;\n'
export const HISTORY_TEMPLATE = 'Cliente;Fecha;Peso (kg)\nLaura Gómez;01/09/2026;72,0\nLaura Gómez;15/09/2026;70,5\nCarlos Ruiz;01/09/2026;78\n'
export const NOTES_TEMPLATE = 'Cliente;Fecha;Nota\nLaura Gómez;01/09/2026;Primera consulta. Objetivo: perder 6 kg. Intolerancia a la lactosa.\nLaura Gómez;15/09/2026;Mejor energía. Adherencia buena.\nCarlos Ruiz;01/09/2026;Entrena 4 días. Quiere ganar masa.\n'
export const LABS_TEMPLATE = 'Cliente;Fecha;Marcador;Valor\nLaura Gómez;01/09/2026;Glucosa;92\nLaura Gómez;01/09/2026;Colesterol total;201,5\nLaura Gómez;01/09/2026;Vitamina D;24\nCarlos Ruiz;01/09/2026;Glucosa;88\n'
