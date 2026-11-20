import { describe, it, expect } from 'vitest'
import {
  CONFIRMATION_REQUIRED_MESSAGE, GuardProfile, decideApply, decideSave, evaluateTargets, parseTarget, targetsChanged, targetsFingerprint,
} from './planGuard'

const TODAY = new Date(2026, 10, 19, 12)
const adulta: GuardProfile = { sex: 'mujer', ageYears: 35, heightCm: 165, reproductiveStatus: 'ninguno', reproductiveCheck: 'ready' }
const ev = (t: Parameters<typeof evaluateTargets>[3], p: Partial<GuardProfile> = {}, goal: string | null = 'mantenimiento', kg: number | null = 60) =>
  evaluateTargets({ ...adulta, ...p }, goal, kg, t, { today: TODAY })
const codes = (e: { signals: { code: string }[] }) => e.signals.map(s => s.code)

describe('planes manuales: entrada de kcal y macros', () => {
  it('un objetivo vacío no se evalúa (no hay nada que guardar)', () => {
    for (const kcal of ['', '0', null, undefined, 'abc']) expect(ev({ kcal, proteinG: '', carbsG: '', fatG: '' }).signals, String(kcal)).toEqual([])
  })
  it('un objetivo bajo pide revisión: umbral de 1.200 y TMB (con el último peso conocido)', () => {
    const e = ev({ kcal: '1100', proteinG: '90', carbsG: '120', fatG: '40' })
    expect(codes(e)).toEqual(expect.arrayContaining(['OBJETIVO_BAJO_UMBRAL', 'OBJETIVO_BAJO_TMB']))
    expect(e.needsProfessionalReview).toBe(true)
    expect(e.blocked).toBe(false)
  })
  it('sin peso conocido no se inventa la TMB: solo el umbral', () => {
    expect(codes(ev({ kcal: '1100', proteinG: '90', carbsG: '95', fatG: '40' }, {}, 'mantenimiento', null))).toEqual(['OBJETIVO_BAJO_UMBRAL']) // 360+380+360 = 1.100: cuadra
  })
  it('un objetivo normal no genera señales de revisión', () => {
    const e = ev({ kcal: '2000', proteinG: '150', carbsG: '200', fatG: '67' })
    expect(e.needsProfessionalReview).toBe(false)
    expect(e.blocked).toBe(false)
  })
  it('INCOMPATIBLE: proteína + grasa por encima de las kcal bloquea (aunque los hidratos estén a 0)', () => {
    const e = ev({ kcal: '1500', proteinG: '200', carbsG: '0', fatG: '100' }) // 800 + 900 = 1.700 > 1.500
    expect(codes(e)).toContain('MACROS_INCOMPATIBLES')
    expect(e.blocked).toBe(true)
  })
  it('con gramos escritos, un exceso dentro del redondeo no bloquea (se dice, como nota), y más allá sí', () => {
    // 150×4 + 150×9 = 1.950 frente a 1.945: +5 kcal, dentro de las 9 del redondeo
    const dentro = ev({ kcal: '1945', proteinG: '150', carbsG: '0', fatG: '150' })
    expect(codes(dentro)).not.toContain('MACROS_INCOMPATIBLES')
    expect(codes(dentro)).toContain('MACROS_REDONDEO')
    // +20 kcal: ya no es redondeo
    expect(codes(ev({ kcal: '1930', proteinG: '150', carbsG: '0', fatG: '150' }))).toContain('MACROS_INCOMPATIBLES')
  })
  it('MACROS_NO_CUADRAN se ejecuta de verdad en este flujo: kcal y macros incoherentes avisan', () => {
    const e = ev({ kcal: '2000', proteinG: '150', carbsG: '300', fatG: '100' }) // suman 2.700
    expect(codes(e)).toContain('MACROS_NO_CUADRAN')
    expect(e.signals.find(s => s.code === 'MACROS_NO_CUADRAN')!.evidence).toMatchObject({ kcal: 2000, kcalDeMacros: 2700, diferencia: 700, toleranciaRedondeo: 9 })
    // por debajo del objetivo también avisa, pero con la tolerancia relativa (3 %), no la del redondeo
    expect(codes(ev({ kcal: '2000', proteinG: '100', carbsG: '150', fatG: '50' }))).toContain('MACROS_NO_CUADRAN') // 1.450
    expect(codes(ev({ kcal: '2000', proteinG: '150', carbsG: '200', fatG: '60' }))).not.toContain('MACROS_NO_CUADRAN') // 1.940: −60 = el 3 %, dentro
    expect(codes(ev({ kcal: '2000', proteinG: '150', carbsG: '195', fatG: '60' }))).toContain('MACROS_NO_CUADRAN') // 1.920: −80, más del 3 %
  })
  it('separa REDONDEO de INCOHERENCIA: +3 kcal es redondeo (nota), +30 kcal es incoherencia (aviso)', () => {
    const redondeo = ev({ kcal: '2000', proteinG: '150', carbsG: '200', fatG: '67' }) // 600+800+603 = 2.003
    expect(codes(redondeo)).toContain('MACROS_REDONDEO')
    expect(codes(redondeo)).not.toContain('MACROS_NO_CUADRAN')
    expect(redondeo.level).toBe('ok')
    const incoherente = ev({ kcal: '2000', proteinG: '150', carbsG: '207', fatG: '67' }) // 2.031
    expect(codes(incoherente)).toContain('MACROS_NO_CUADRAN')
    expect(codes(incoherente)).not.toContain('MACROS_REDONDEO')
  })
  it('población: menor de edad bloquea el objetivo; embarazo + objetivo de perder peso bloquea', () => {
    expect(ev({ kcal: '1800', proteinG: '120', carbsG: '200', fatG: '60' }, { ageYears: 15 }).blocked).toBe(true)
    const emb = ev({ kcal: '1800', proteinG: '120', carbsG: '200', fatG: '60' }, { reproductiveStatus: 'embarazo' }, 'perder_peso')
    expect(codes(emb)).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
    expect(emb.blocked).toBe(true)
  })
})

describe('anamnesis: cargando, leído y error no son lo mismo', () => {
  const t = { kcal: '1800', proteinG: '120', carbsG: '200', fatG: '60' }
  it('cargando bloquea; error pide revisión; leído con respuesta vacía solo es una nota', () => {
    const cargando = ev(t, { reproductiveStatus: 'no_consta', reproductiveCheck: 'loading' })
    expect(codes(cargando)).toContain('ANAMNESIS_NO_COMPROBADA')
    expect(cargando.blocked).toBe(true)
    const error = ev(t, { reproductiveStatus: 'no_consta', reproductiveCheck: 'error' })
    expect(codes(error)).toContain('ANAMNESIS_NO_COMPROBADA')
    expect(error).toMatchObject({ blocked: false, needsProfessionalReview: true })
    const leido = ev(t, { reproductiveStatus: 'no_consta', reproductiveCheck: 'ready' })
    expect(codes(leido)).not.toContain('ANAMNESIS_NO_COMPROBADA')
    expect(codes(leido)).toContain('EMBARAZO_LACTANCIA_NO_CONSTA')
  })
  it('un error NO equivale a «no hay embarazo»: el aviso lo dice con esas palabras', () => {
    const s = ev(t, { reproductiveStatus: 'no_consta', reproductiveCheck: 'error' }).signals.find(x => x.code === 'ANAMNESIS_NO_COMPROBADA')!
    expect(s.explanation).toMatch(/NO significa que no haya embarazo/)
    expect(s.title).toMatch(/No se ha podido comprobar/)
  })
  it('si se sabe que hay embarazo, un error de lectura no lo borra', () => {
    expect(codes(ev(t, { reproductiveStatus: 'embarazo', reproductiveCheck: 'error' }, 'perder_peso'))).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
  })
})

describe('huella, confirmación y guardado', () => {
  const base = { kcal: '1100', proteinG: '90', carbsG: '120', fatG: '40' }
  const guard = (t: typeof base, p: Partial<GuardProfile> = {}) => { const e = ev(t, p); return { e, fp: targetsFingerprint(t, e) } }

  it('la huella cambia con cualquier objetivo y es la misma para el mismo objetivo escrito de otra forma', () => {
    const a = guard(base)
    expect(guard({ ...base, kcal: '1150' }).fp).not.toBe(a.fp)
    expect(guard({ ...base, proteinG: '91' }).fp).not.toBe(a.fp)
    expect(guard({ ...base, carbsG: '121' }).fp).not.toBe(a.fp)
    expect(guard({ ...base, fatG: '41' }).fp).not.toBe(a.fp)
    expect(targetsFingerprint({ kcal: 1100, proteinG: 90, carbsG: 120, fatG: 40 }, a.e)).toBe(a.fp)
    expect(targetsFingerprint({ kcal: '1100.0', proteinG: '90', carbsG: '120', fatG: '40' }, a.e)).toBe(a.fp)
  })
  it('la huella cambia si cambian los datos del cliente de forma que cambian las señales', () => {
    expect(guard(base, { reproductiveCheck: 'error', reproductiveStatus: 'no_consta' }).fp).not.toBe(guard(base).fp)
  })
  it('targetsChanged: compara lo guardado con lo del formulario', () => {
    expect(targetsChanged(null, base)).toBe(true)
    expect(targetsChanged(null, { kcal: '', proteinG: '', carbsG: '', fatG: '' })).toBe(false)
    expect(targetsChanged({ kcal: 1100, proteinG: 90, carbsG: 120, fatG: 40 }, base)).toBe(false)
    expect(targetsChanged({ kcal: 1100, proteinG: 90, carbsG: 120, fatG: 40 }, { ...base, kcal: '1101' })).toBe(true)
    expect(targetsChanged({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, { kcal: '', proteinG: '', carbsG: '', fatG: '' })).toBe(false)
  })
  it('sin cambios en los objetivos se guarda sin reconfirmar (p. ej. solo se tocan las comidas), aunque el objetivo antiguo sea bajo', () => {
    const { e, fp } = guard(base)
    expect(decideSave({ evaluation: e, fingerprint: fp, confirmedFingerprint: null, changed: false })).toEqual({ allowed: true, reason: 'sin_cambios', message: null })
  })
  it('un objetivo nuevo con señales de revisión NO se guarda sin confirmar, y el mensaje no promete trazabilidad', () => {
    const { e, fp } = guard(base)
    const d = decideSave({ evaluation: e, fingerprint: fp, confirmedFingerprint: null, changed: true })
    expect(d).toMatchObject({ allowed: false, reason: 'falta_confirmacion', message: CONFIRMATION_REQUIRED_MESSAGE })
    expect(CONFIRMATION_REQUIRED_MESSAGE).toMatch(/no queda registrada/)
    expect(CONFIRMATION_REQUIRED_MESSAGE).not.toMatch(/trazab|auditor[ií]a registrada/i)
  })
  it('confirmado el MISMO objetivo evaluado, se guarda', () => {
    const { e, fp } = guard(base)
    expect(decideSave({ evaluation: e, fingerprint: fp, confirmedFingerprint: fp, changed: true })).toMatchObject({ allowed: true, reason: 'ok' })
  })
  it('MODIFICACIÓN POSTERIOR A LA EVALUACIÓN: si se cambia el objetivo tras confirmar, la confirmación ya no vale', () => {
    const evaluado = guard(base)
    const modificado = guard({ ...base, kcal: '1050' })
    const d = decideSave({ evaluation: modificado.e, fingerprint: modificado.fp, confirmedFingerprint: evaluado.fp, changed: true })
    expect(d).toMatchObject({ allowed: false, reason: 'falta_confirmacion' })
  })
  it('GUARDAR UN OBJETIVO DISTINTO DEL EVALUADO: otro objetivo bajo, aunque tenga las mismas señales, exige una nueva confirmación', () => {
    const a = guard(base)
    const b = guard({ kcal: '1000', proteinG: '80', carbsG: '100', fatG: '40' })
    expect(codes(a.e)).toEqual(codes(b.e)) // mismas señales…
    expect(a.fp).not.toBe(b.fp) // …pero huella distinta
    expect(decideSave({ evaluation: b.e, fingerprint: b.fp, confirmedFingerprint: a.fp, changed: true }).allowed).toBe(false)
  })
  it('lo incompatible o incalculable se bloquea siempre que el objetivo sea nuevo, estuviera confirmado o no', () => {
    const t = { kcal: '1500', proteinG: '200', carbsG: '0', fatG: '100' }
    const { e, fp } = guard(t)
    const d = decideSave({ evaluation: e, fingerprint: fp, confirmedFingerprint: fp, changed: true })
    expect(d).toMatchObject({ allowed: false, reason: 'bloqueado' })
    expect(d.message).toMatch(/Proteína y grasa superan el objetivo energético/)
    const menor = guard({ kcal: '1800', proteinG: '120', carbsG: '200', fatG: '60' }, { ageYears: 14 })
    expect(decideSave({ evaluation: menor.e, fingerprint: menor.fp, confirmedFingerprint: menor.fp, changed: true }).reason).toBe('bloqueado')
  })
})

describe('plantillas y restauraciones: se evalúan con los datos de hoy del cliente', () => {
  const plantilla = { kcal: 1800, proteinG: 130, carbsG: 200, fatG: 60 }
  it('una plantilla razonable para un adulto se aplica', () => {
    expect(decideApply(ev(plantilla), 'plantilla')).toEqual({ allowed: true, message: null })
  })
  it('la misma plantilla NO se aplica a un menor de edad (no se asume que una plantilla válida siga siendo adecuada)', () => {
    const d = decideApply(ev(plantilla, { ageYears: 16 }), 'plantilla')
    expect(d.allowed).toBe(false)
    expect(d.message).toMatch(/No se aplica la plantilla/)
    expect(d.message).toMatch(/Menor de 18 años/)
  })
  it('una plantilla de déficit deja de poder aplicarse cuando consta embarazo, aunque antes sí', () => {
    expect(decideApply(ev(plantilla, { reproductiveStatus: 'ninguno' }, 'perder_peso'), 'plantilla').allowed).toBe(true)
    expect(decideApply(ev(plantilla, { reproductiveStatus: 'embarazo' }, 'perder_peso'), 'plantilla').allowed).toBe(false)
  })
  it('mientras el cuestionario carga no se aplica; con error se aplica pero con señal de revisión (luego hará falta confirmar al guardar)', () => {
    expect(decideApply(ev(plantilla, { reproductiveStatus: 'no_consta', reproductiveCheck: 'loading' }), 'plantilla').allowed).toBe(false)
    const error = ev(plantilla, { reproductiveStatus: 'no_consta', reproductiveCheck: 'error' })
    expect(decideApply(error, 'plantilla').allowed).toBe(true)
    expect(error.needsProfessionalReview).toBe(true)
  })
  it('una versión con macros incompatibles no se restaura; el texto dice «versión»', () => {
    const d = decideApply(ev({ kcal: 1500, proteinG: 200, carbsG: 0, fatG: 100 }), 'versión')
    expect(d.allowed).toBe(false)
    expect(d.message).toMatch(/No se aplica la versión/)
  })
  it('una plantilla baja se aplica pero queda señalada (revisión) para exigir la confirmación al guardar', () => {
    const e = ev({ kcal: 1100, proteinG: 90, carbsG: 120, fatG: 40 })
    expect(decideApply(e, 'plantilla').allowed).toBe(true)
    expect(e.needsProfessionalReview).toBe(true)
  })
})

describe('parseTarget', () => {
  it('lee números con coma o punto y descarta lo que no lo es', () => {
    expect(parseTarget('1800')).toBe(1800)
    expect(parseTarget('12,5')).toBe(12.5)
    for (const v of ['', 'abc', null, undefined, NaN, Infinity]) expect(parseTarget(v as never), String(v)).toBeNull()
  })
})
