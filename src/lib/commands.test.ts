import { describe, expect, it } from 'vitest'
import { Command, filterCommands } from './commands'

const cmd = (id: string, label: string, over: Partial<Command> = {}): Command => ({ id, label, group: 'Acciones', run: () => {}, ...over })
const commands = [
  cmd('cal', 'Ir al calendario', { keywords: ['cita', 'agenda'], hint: 'Consulta' }),
  cmd('new', 'Nuevo cliente'),
  cmd('imp', 'Traer clientes desde un archivo', { keywords: ['importar', 'excel', 'csv'] }),
  cmd('hist', 'Importar historial de peso'),
  cmd('plan', 'Plan de Laura Gómez', { hint: 'Cliente' }),
]

describe('filterCommands', () => {
  it('finds by name, keyword or hint, ignoring accents and case', () => {
    expect(filterCommands(commands, 'CITA').map(c => c.id)).toEqual(['cal'])
    expect(filterCommands(commands, 'gomez').map(c => c.id)).toEqual(['plan'])
    expect(filterCommands(commands, 'consulta').map(c => c.id)).toEqual(['cal'])
  })
  it('needs every word to match', () => {
    expect(filterCommands(commands, 'importar historial').map(c => c.id)).toEqual(['hist'])
    expect(filterCommands(commands, 'importar zzz')).toEqual([])
  })
  it('puts the ones that start with what was typed first, then the rest', () => {
    expect(filterCommands(commands, 'importar').map(c => c.id)).toEqual(['hist', 'imp'])
    expect(filterCommands(commands, 'cliente').map(c => c.id)).toEqual(['new', 'imp', 'plan'])
  })
  it('shows the first ones when nothing is typed, up to the limit', () => {
    expect(filterCommands(commands, '', 2).map(c => c.id)).toEqual(['cal', 'new'])
    expect(filterCommands(commands, '   ', 3)).toHaveLength(3)
  })
});
