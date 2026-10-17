// Buscador de acciones (Ctrl+K): escribir "crear cita" o "importar" y llegar, sin tener que recordar en qué menú está.
import { stripAccents } from './spreadsheet'

export interface Command {
  id: string
  label: string
  /** Texto pequeño a la derecha (dónde está, o qué hace). */
  hint?: string
  /** Otras formas de buscarlo ("cita" para el calendario). */
  keywords?: string[]
  group: string
  run: () => void
}

const norm = (s: string) => stripAccents(s).toLowerCase()

/**
 * Los comandos que encajan con lo escrito: deben contener todas las palabras (en el nombre, el aviso o las palabras clave).
 * Primero los que empiezan por lo escrito, luego los que lo tienen en el nombre, luego el resto. Sin nada escrito, los primeros.
 */
export function filterCommands(commands: Command[], query: string, limit = 8): Command[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return commands.slice(0, limit)
  const scored: { c: Command; score: number }[] = []
  for (const c of commands) {
    const label = norm(c.label)
    const haystack = `${label} ${norm(c.hint ?? '')} ${(c.keywords ?? []).map(norm).join(' ')}`
    if (!words.every(w => haystack.includes(w))) continue
    const score = label.startsWith(words[0]) ? 0 : words.every(w => label.includes(w)) ? 1 : 2
    scored.push({ c, score })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(s => s.c)
}
