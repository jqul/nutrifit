// Navegación del panel del nutricionista (UX-21): las 8 secciones dejan de ser
// una fila plana y se agrupan por lo que hace el nutricionista con ellas. Cada
// sección (View) pertenece a exactamente un grupo; los grupos con más de una
// sección muestran un segundo nivel de pestañas.

export type View = 'inicio' | 'clientes' | 'calendario' | 'negocio' | 'conversor' | 'micronutrientes' | 'plantillas' | 'difusion' | 'ajustes' | 'ayuda'

export interface NavGroup {
  id: string
  label: string
  views: { id: View; label: string }[]
  /** Secciones de uso menos frecuente (Ajustes, Ayuda): se muestran aparte, a la derecha del menú. */
  secondary?: boolean
}

// Cuatro secciones de trabajo, nombradas por lo que se hace en ellas, y dos de uso ocasional aparte.
export const NAV_GROUPS: NavGroup[] = [
  { id: 'inicio', label: 'Inicio', views: [{ id: 'inicio', label: 'Inicio' }] },
  { id: 'clientes', label: 'Clientes', views: [{ id: 'clientes', label: 'Clientes' }] },
  {
    id: 'planes', label: 'Planes y recursos',
    views: [{ id: 'plantillas', label: 'Plantillas, recetas y guías' }, { id: 'conversor', label: 'Conversor' }, { id: 'micronutrientes', label: 'Micronutrientes' }],
  },
  {
    id: 'consulta', label: 'Consulta',
    views: [{ id: 'calendario', label: 'Calendario' }, { id: 'difusion', label: 'Difusión' }, { id: 'negocio', label: 'Negocio' }],
  },
  { id: 'ajustes', label: 'Ajustes', secondary: true, views: [{ id: 'ajustes', label: 'Ajustes' }] },
  { id: 'ayuda', label: 'Ayuda', secondary: true, views: [{ id: 'ayuda', label: 'Ayuda' }] },
]

/** Grupo al que pertenece una sección. */
export function groupOfView(view: View): NavGroup {
  const group = NAV_GROUPS.find(g => g.views.some(v => v.id === view))
  if (!group) throw new Error(`La sección "${view}" no pertenece a ningún grupo de navegación`)
  return group
}

/** Sección a la que lleva pulsar un grupo: la última que se vio en él, o la primera. */
export function viewForGroup(group: NavGroup, lastViewByGroup: Partial<Record<string, View>>): View {
  const last = lastViewByGroup[group.id]
  return last && group.views.some(v => v.id === last) ? last : group.views[0].id
}
