// ¿Se puede borrar la cuenta de acceso (auth.users) al eliminar una ficha? Función pura, probada en src/lib/deleteClientAccount.test.ts.
//
// Antes, delete-client borraba SIEMPRE la cuenta guardada en clientes.auth_user_id (salvo que fuera de un nutricionista). Como un profesional podía
// escribir ese campo con un UPDATE directo, podía apuntarlo a la cuenta de OTRA persona y borrársela eliminando la ficha. Ahora el campo solo lo cambian
// los procedimientos de vinculación (0077/0078) y, además, la función exige tres hechos que se leen ANTES de borrar la ficha (al borrarla, el registro
// de vinculaciones anota su propio desenlace y dejaría de servir como prueba).

export interface AccountFacts {
  authUserId: string | null
  /** La cuenta pertenece a un profesional (nutricionistas.uid). */
  isNutricionista: boolean
  /** Nº de OTRAS fichas que tienen a esta misma cuenta como titular. */
  otherLinkedFichas: number
  /** El último evento de vinculación de la ficha es una vinculación (o reasignación) que dejó a ESTA cuenta como titular. */
  linkAttestedByLog: boolean
}

export function decideAccountDeletion(f: AccountFacts): { delete: boolean; reason: string } {
  if (!f.authUserId) return { delete: false, reason: 'la ficha no tenía cuenta vinculada' }
  if (f.isNutricionista) return { delete: false, reason: 'la cuenta es también la de un profesional' }
  if (f.otherLinkedFichas > 0) return { delete: false, reason: 'la cuenta es también titular de otra ficha' }
  if (!f.linkAttestedByLog) return { delete: false, reason: 'el vínculo con esta cuenta no consta en el registro de vinculaciones' }
  return { delete: true, reason: 'cuenta vinculada por el procedimiento normal y exclusiva de esta ficha' }
}

/** Interpreta la última fila de client_link_events de la ficha (eventos de vinculación, de más reciente a más antigua). */
export function linkAttested(lastEvent: { event?: string | null; new_uid?: string | null } | null | undefined, authUserId: string | null): boolean {
  return !!lastEvent && !!authUserId && (lastEvent.event === 'linked' || lastEvent.event === 'reassigned') && lastEvent.new_uid === authUserId
}
