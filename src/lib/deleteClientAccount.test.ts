import { describe, it, expect } from 'vitest'
import { decideAccountDeletion, linkAttested } from '../../supabase/functions/delete-client/accountDeletion'

const UID = '00000000-0000-4000-8000-0000000000c1'
const ok = { authUserId: UID, isNutricionista: false, otherLinkedFichas: 0, linkAttestedByLog: true }

describe('delete-client: cuándo se borra la cuenta de acceso de una clienta', () => {
  it('solo si la cuenta está vinculada, no es de un profesional, no es titular de otra ficha y el vínculo consta en el registro', () => {
    expect(decideAccountDeletion(ok).delete).toBe(true)
  })
  it.each([
    ['sin cuenta vinculada', { ...ok, authUserId: null }],
    ['cuenta de un profesional', { ...ok, isNutricionista: true }],
    ['cuenta titular de otra ficha (reasignación maliciosa hacia la cuenta de un tercero)', { ...ok, otherLinkedFichas: 1 }],
    ['vínculo que no consta en el registro de vinculaciones', { ...ok, linkAttestedByLog: false }],
  ])('NO borra: %s', (_nombre, f) => {
    const d = decideAccountDeletion(f); expect(d.delete).toBe(false); expect(d.reason.length).toBeGreaterThan(10)
  })
  it('linkAttested: solo cuenta si el último evento es una vinculación o reasignación cuya cuenta nueva es la de la ficha', () => {
    expect(linkAttested({ event: 'linked', new_uid: UID }, UID)).toBe(true)
    expect(linkAttested({ event: 'reassigned', new_uid: UID }, UID)).toBe(true)
    expect(linkAttested({ event: 'unlinked', new_uid: null }, UID)).toBe(false)
    expect(linkAttested({ event: 'linked', new_uid: 'otra' }, UID)).toBe(false)
    expect(linkAttested(null, UID)).toBe(false)
    expect(linkAttested({ event: 'linked', new_uid: UID }, null)).toBe(false)
  })
})
