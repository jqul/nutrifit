import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AllergyNotice } from './AllergyNotice'

// Prueba de la pantalla real del aviso (se renderiza el componente), sin navegador.
const html = (allergies: string | null | undefined, audience: 'pro' | 'client' = 'client', compact = false) =>
  renderToStaticMarkup(<AllergyNotice allergies={allergies} audience={audience} compact={compact} />)

describe('AllergyNotice: cuándo NO sale', () => {
  it.each(['', '   ', null, undefined, 'ninguna', 'Ninguna', 'NINGUNA', 'n/a', 'N/A', 'Ninguna conocida', 'no', 'No tiene', 'sin alergias', '-', 'nada'])('«%s» no pinta nada', text => {
    expect(html(text as string)).toBe('')
    expect(html(text as string, 'pro')).toBe('')
    expect(html(text as string, 'client', true)).toBe('')
  })
})

describe('AllergyNotice: cuándo sale y qué dice', () => {
  it('cliente: la frase aprobada y la línea de la alergia', () => {
    const out = html('Gluten')
    expect(out).toContain('role="note"')
    expect(out).toContain('La información sobre alérgenos es orientativa y puede estar incompleta.')
    expect(out).toContain('no lo consideres apto hasta verificarlo')
    expect(out).toContain('categoría reconocida, detección limitada')
  })
  it('profesional: su propia frase', () => {
    const out = html('Gluten', 'pro')
    expect(out).toContain('La comprobación de alérgenos es orientativa, limitada y puede estar incompleta.')
    expect(out).toContain('no significa que sea seguro')
    expect(out).not.toContain('no lo consideres apto')
  })
  it('compacto: solo el aviso general si el detector está comprobando todas las alergias escritas', () => {
    const out = html('Gluten', 'client', true)
    expect(out).toContain('orientativa y puede estar incompleta')
    expect(out).not.toContain('categoría reconocida')
    expect(out).not.toContain('<ul')
  })
  it('compacto: añade las líneas de las alergias que el detector NO comprueba (así las sugerencias no parecen excluirlas)', () => {
    const celiac = html('Celiaquía', 'client', true)
    expect(celiac).toContain('<ul')
    expect(celiac).toContain('no identifica todos los alimentos con gluten')
    expect(html('alergia al sésamo', 'client', true)).toContain('categoría no reconocida')
    expect(html('me sienta mal la comida', 'client', true)).toContain('información ambigua')
    // Una alergia comprobada y otra no: en compacto solo sale la que no se comprueba.
    const mixed = html('gluten y sésamo', 'client', true)
    expect((mixed.match(/<li/g) ?? []).length).toBe(1)
    expect(mixed).toContain('Sésamo')
    expect(mixed).not.toContain('Gluten:')
  })
  it('una línea por alergia, con su estado', () => {
    const out = html('Celiaquía y alergia al sésamo, me sienta mal la comida')
    expect(out).toContain('categoría reconocida, detección limitada')
    expect(out).toContain('categoría no reconocida')
    expect(out).toContain('información ambigua')
    expect((out.match(/<li/g) ?? []).length).toBe(3)
  })
  it('celiaquía y celíaca: reconocidas, pero avisa de que el detector actual no marca alimentos', () => {
    for (const t of ['Celiaquía', 'celíaca', 'enfermedad celíaca']) {
      const out = html(t)
      expect(out, t).toContain('categoría reconocida, detección limitada')
      expect(out, t).toContain('no identifica todos los alimentos con gluten')
      expect(out, t).toContain('no marca ninguno')
    }
  })
  it('celíaco y gluten: el detector sí se activa, y no lleva ese aviso', () => {
    for (const t of ['celíaco', 'gluten']) expect(html(t), t).not.toContain('no marca ninguno')
  })
  it('la pista de cómo escribirlo es solo para el profesional', () => {
    expect(html('celiaquía', 'pro')).toContain('«celíaco» o «gluten»')
    expect(html('celiaquía', 'client')).not.toContain('Perfil')
  })
  it('ningún texto del aviso promete seguridad', () => {
    const FORBIDDEN = /cubiert|garantiz|certific|libre de|es segur|son segur|sin riesgo/i
    for (const t of ['gluten', 'celiaquía', 'sésamo', 'me sienta mal la comida', 'kiwi']) {
      for (const a of ['pro', 'client'] as const) {
        // «no significa que sea seguro» y «no lo consideres apto» son negaciones; se comprueba sin esas frases.
        const out = html(t, a).replace('no significa que sea seguro', '').replace('no lo consideres apto hasta verificarlo', '')
        expect(out, `${t}/${a}`).not.toMatch(FORBIDDEN)
        expect(out, `${t}/${a}`).not.toMatch(/\bapto\b/i)
      }
    }
  })
})
