import { LEGAL_ENTITY } from './entity'
import privacidad from './privacidad.md?raw'
import clientes from './clientes.md?raw'
import terminos from './terminos.md?raw'
import encargado from './encargado.md?raw'
import avisoLegal from './aviso-legal.md?raw'
import cookies from './cookies.md?raw'

export type LegalSlug = 'privacidad' | 'clientes' | 'terminos' | 'encargado' | 'aviso' | 'cookies'

export interface LegalDocument { slug: LegalSlug; title: string; raw: string }

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  { slug: 'terminos', title: 'Condiciones de uso', raw: terminos },
  { slug: 'privacidad', title: 'Política de privacidad', raw: privacidad },
  { slug: 'encargado', title: 'Contrato de encargado del tratamiento', raw: encargado },
  { slug: 'clientes', title: 'Información para clientes', raw: clientes },
  { slug: 'cookies', title: 'Cookies y almacenamiento local', raw: cookies },
  { slug: 'aviso', title: 'Aviso legal', raw: avisoLegal },
]

export const isLegalSlug = (s: unknown): s is LegalSlug => LEGAL_DOCUMENTS.some(d => d.slug === s)

/** Las claves {{clave}} que usa un texto. */
export const placeholdersIn = (raw: string): string[] => [...new Set([...raw.matchAll(/\{\{([a-z_]+)\}\}/g)].map(m => m[1]))]

/** Sustituye las {{claves}} por los datos del titular. Una clave desconocida se deja visible, para que no pase inadvertida. */
export function fillTemplate(raw: string, entity: Record<string, string> = LEGAL_ENTITY): string {
  return raw.replace(/\{\{([a-z_]+)\}\}/g, (whole, key: string) => entity[key] ?? whole)
}

/** Datos aún por completar: lo que queda entre [CORCHETES EN MAYÚSCULAS] o como {{clave}} sin definir. */
export function pendingItems(text: string): string[] {
  return [...new Set([...text.matchAll(/\[[A-ZÁÉÍÓÚÑ][^\]\n]*\]|\{\{[a-z_]+\}\}/g)].map(m => m[0]))]
}
