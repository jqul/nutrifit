import { describe, it, expect } from 'vitest'
import { NAV_GROUPS, groupOfView, viewForGroup, View } from './dashboardNav'

// Si se añade una sección al tipo View y no a un grupo, esta lista deja de cubrirla.
const ALL_VIEWS: View[] = ['clientes', 'calendario', 'negocio', 'conversor', 'micronutrientes', 'plantillas', 'difusion', 'ajustes']

describe('NAV_GROUPS', () => {
  it('puts every view in exactly one group', () => {
    for (const view of ALL_VIEWS) {
      const owners = NAV_GROUPS.filter(g => g.views.some(v => v.id === view))
      expect(owners, `la sección ${view}`).toHaveLength(1)
    }
  })

  it('does not contain views outside the known list', () => {
    const grouped = NAV_GROUPS.flatMap(g => g.views.map(v => v.id)).sort()
    expect(grouped).toEqual([...ALL_VIEWS].sort())
  })

  it('has unique group ids and no empty groups', () => {
    const ids = NAV_GROUPS.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(NAV_GROUPS.every(g => g.views.length > 0)).toBe(true)
  })

  it('keeps Clientes as the first group', () => {
    expect(NAV_GROUPS[0].views[0].id).toBe('clientes')
  })
})

describe('groupOfView', () => {
  it('finds the group of a view', () => {
    expect(groupOfView('difusion').id).toBe('comunicacion')
    expect(groupOfView('micronutrientes').id).toBe('herramientas')
    expect(groupOfView('ajustes').id).toBe('ajustes')
  })
})

describe('viewForGroup', () => {
  const comunicacion = NAV_GROUPS.find(g => g.id === 'comunicacion')!
  it('goes to the first view when the group was never visited', () => {
    expect(viewForGroup(comunicacion, {})).toBe('calendario')
  })
  it('goes back to the last view seen in that group', () => {
    expect(viewForGroup(comunicacion, { comunicacion: 'difusion' })).toBe('difusion')
  })
  it('ignores a remembered view that is not part of the group', () => {
    expect(viewForGroup(comunicacion, { comunicacion: 'conversor' })).toBe('calendario')
  })
})
