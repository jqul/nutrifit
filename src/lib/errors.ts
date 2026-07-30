import { PostgrestError } from '@supabase/supabase-js'
const ERROR_MESSAGES: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos.',
  '23503': 'Referencia no válida.',
  '42501': 'Sin permisos para realizar esta acción.',
  'PGRST116': 'No se encontró el registro.',
  'PGRST301': 'Sin permisos de acceso.',
}
export function getErrorMessage(error: PostgrestError | null): string {
  if (!error) return ''
  return ERROR_MESSAGES[error.code] || error.message || 'Error desconocido'
}
export function logError(context: string, error: PostgrestError | null) {
  if (!error) return
  console.error(`[${context}]`, error.code, error.message, error.details)
}
