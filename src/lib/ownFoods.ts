// Acceso a los alimentos propios del nutricionista (tabla foods con
// nutricionista_id) y traducción de los errores de la base de datos a mensajes
// que se entienden. La validación previa está en foodDraft.ts; esto es la red
// de seguridad por si algo llega a la base de datos sin pasar por ella.
import { supabase } from './supabase'
import { Food } from '../types'
import { foodFromRow } from './mappers'
import { FoodDraft, draftToColumns } from './foodDraft'

interface DbError { code?: string; message: string }

/** Mensaje claro para un error de la tabla foods. */
export function friendlyFoodError(error: DbError): string {
  if (error.code === '23505') return 'Ya existe un alimento con ese nombre en el catálogo.'
  if (error.code === '23514') return 'Los valores no son válidos: revisa que sean por 100 g (máximo 950 kcal y 100 g de macros).'
  if (error.code === '42501') return 'No tienes permiso para modificar este alimento.'
  return error.message
}

export type FoodResult = { food: Food; error?: undefined } | { food?: undefined; error: string }

export async function createOwnFood(nutricionistaId: string, draft: FoodDraft): Promise<FoodResult> {
  const { data, error } = await supabase.from('foods')
    .insert({ nutricionista_id: nutricionistaId, ...draftToColumns(draft), reference: 'Añadido por ti' }).select().single()
  return error ? { error: friendlyFoodError(error) } : { food: foodFromRow(data) }
}

export async function updateOwnFood(id: string, draft: FoodDraft): Promise<FoodResult> {
  const { data, error } = await supabase.from('foods').update(draftToColumns(draft)).eq('id', id).select().single()
  return error ? { error: friendlyFoodError(error) } : { food: foodFromRow(data) }
}

export async function deleteOwnFood(id: string): Promise<string | null> {
  const { error } = await supabase.from('foods').delete().eq('id', id)
  return error ? friendlyFoodError(error) : null
}

/**
 * En cuántos platos de planes del nutricionista aparece un alimento. Los platos
 * guardan el nombre y sus propios valores, así que seguirán ahí aunque el
 * alimento se borre o cambie; lo que dejan de poder hacer es sustituirse o
 * agruparse en la lista de la compra. La base de datos solo devuelve los planes
 * de sus clientes, así que el recuento es suyo. null si no se pudo contar.
 */
export async function countFoodUsage(name: string): Promise<number | null> {
  const { count, error } = await supabase.from('diet_meal_items').select('id', { count: 'exact', head: true }).eq('food_name', name)
  return error ? null : (count ?? 0)
}
