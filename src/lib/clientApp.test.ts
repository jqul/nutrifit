import { describe, it, expect } from 'vitest'
import { CLIENT_TOKEN_KEY, buildClientManifest, cleanAppName, containRect, shortAppName, decideForNonTrainerSession, fetchMyClientToken, forgetClientToken, isValidClientToken, readRememberedClientToken, rememberClientToken } from './clientApp'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, raw: m }
}
const TOKEN = '3f9a1c0be2d74a56a8f0c1b2d3e4f506'

describe('isValidClientToken', () => {
  it('accepts the real hex tokens and the demo ones', () => {
    expect(isValidClientToken(TOKEN)).toBe(true)
    expect(isValidClientToken('demo-token-maria')).toBe(true)
  })
  it('rejects anything that could break a URL or a JSON', () => {
    for (const t of ['', 'ab', 'a b c d e f', 'x"y"z12345', '../../etc', 'a'.repeat(65), '<script>alert(1)</script>', null, undefined, 42]) {
      expect(isValidClientToken(t as unknown), String(t)).toBe(false)
    }
  })
})

describe('remembered client token', () => {
  it('remembers a real token and reads it back', () => {
    const s = memory()
    rememberClientToken(TOKEN, s)
    expect(readRememberedClientToken(s)).toBe(TOKEN)
  })
  it('does not remember demo tokens or invalid ones', () => {
    const s = memory()
    rememberClientToken('demo-token-maria', s)
    rememberClientToken('no valido!', s)
    expect(s.raw.size).toBe(0)
  })
  it('ignores a corrupted stored value', () => {
    const s = memory()
    s.setItem(CLIENT_TOKEN_KEY, '<img src=x>')
    expect(readRememberedClientToken(s)).toBeNull()
  })
  it('forgets it', () => {
    const s = memory()
    rememberClientToken(TOKEN, s)
    forgetClientToken(s)
    expect(readRememberedClientToken(s)).toBeNull()
  })
  it('survives a browser without storage or one that throws', () => {
    expect(readRememberedClientToken(null)).toBeNull()
    expect(() => rememberClientToken(TOKEN, null)).not.toThrow()
    const broken = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') }, removeItem: () => { throw new Error('bloqueado') } }
    expect(readRememberedClientToken(broken)).toBeNull()
    expect(() => rememberClientToken(TOKEN, broken)).not.toThrow()
    expect(() => forgetClientToken(broken)).not.toThrow()
  })
})

describe('fetchMyClientToken', () => {
  it('returns the token of a client', async () => {
    expect(await fetchMyClientToken(async () => ({ data: TOKEN, error: null }))).toEqual({ token: TOKEN, failed: false })
  })
  it('says "not a client" when there is no ficha (null) without calling it a failure', async () => {
    expect(await fetchMyClientToken(async () => ({ data: null, error: null }))).toEqual({ token: null, failed: false })
  })
  it('does not trust a token that is not shaped like one', async () => {
    expect(await fetchMyClientToken(async () => ({ data: '<script>', error: null }))).toEqual({ token: null, failed: false })
  })
  it('reports a failed check, so nobody is signed out because of a network hiccup', async () => {
    expect(await fetchMyClientToken(async () => ({ data: null, error: { message: 'timeout' } }))).toEqual({ token: null, failed: true })
    expect(await fetchMyClientToken(async () => { throw new Error('offline') })).toEqual({ token: null, failed: true })
  })
})

describe('decideForNonTrainerSession', () => {
  const ok = (data: unknown) => async () => ({ data, error: null })
  it('sends a client to their app, keeping the session (this is what stopped the repeated logins)', async () => {
    expect(await decideForNonTrainerSession(ok(TOKEN), false)).toEqual({ kind: 'client', token: TOKEN })
    expect(await decideForNonTrainerSession(ok(TOKEN), true)).toEqual({ kind: 'client', token: TOKEN })
  })
  it('does not sign anyone out when the check fails', async () => {
    expect(await decideForNonTrainerSession(async () => ({ data: null, error: { message: 'timeout' } }), false)).toEqual({ kind: 'keep-session' })
  })
  it('uses the remembered link of the installed app when the user is not a client', async () => {
    expect(await decideForNonTrainerSession(ok(null), true)).toEqual({ kind: 'remembered' })
  })
  it('signs out a session that belongs to nobody', async () => {
    expect(await decideForNonTrainerSession(ok(null), false)).toEqual({ kind: 'sign-out' })
  })
})

describe('buildClientManifest', () => {
  const m = buildClientManifest('https://nutrifit.app', TOKEN)
  it('opens the client link, not the root', () => {
    expect(m.start_url).toBe(`https://nutrifit.app/?c=${TOKEN}`)
    expect(m.id).toBe(m.start_url)
  })
  it('keeps the scope on the whole site so the link keeps working', () => {
    expect(m.scope).toBe('https://nutrifit.app/')
    expect(m.start_url.startsWith(m.scope)).toBe(true)
  })
  it('uses absolute icon URLs (a blob manifest has no base to resolve them)', () => {
    for (const icon of m.icons) expect(icon.src.startsWith('https://nutrifit.app/')).toBe(true)
  })
  it('is installable: standalone, name and a 512 icon', () => {
    expect(m.display).toBe('standalone')
    expect(m.name).toBeTruthy()
    expect(m.icons.some(i => i.sizes === '512x512')).toBe(true)
  })
})

describe('app name', () => {
  it('cleans what the nutritionist types: spaces, length and empty', () => {
    expect(cleanAppName('  Consulta   Marta ')).toBe('Consulta Marta')
    expect(cleanAppName('x'.repeat(40))).toHaveLength(24)
    expect(cleanAppName('   ')).toBeNull()
    expect(cleanAppName(null)).toBeNull()
    expect(cleanAppName(undefined)).toBeNull()
  })
  it('shortens the name for under the icon, at a word when it can', () => {
    expect(shortAppName('Nutri Lucía')).toBe('Nutri Lucía')
    expect(shortAppName('Consulta Marta López')).toBe('Consulta')
    expect(shortAppName('Supercalifragilístico')).toBe('Supercalifra')
  })
  it('goes into the client manifest, and NutriFit stays the default', () => {
    const named = buildClientManifest('https://nutrifit.app', TOKEN, 'Consulta Marta')
    expect(named.name).toBe('Consulta Marta')
    expect(named.short_name).toBe('Consulta')
    expect(named.start_url).toBe(`https://nutrifit.app/?c=${TOKEN}`)
    const plain = buildClientManifest('https://nutrifit.app', TOKEN)
    expect(plain.name).toBe('NutriFit')
    expect(plain.short_name).toBe('NutriFit')
    expect(buildClientManifest('https://nutrifit.app', TOKEN, '  ').name).toBe('NutriFit')
  })
  it('keeps the manifest a valid JSON whatever is typed', () => {
    const m = buildClientManifest('https://nutrifit.app', TOKEN, '"}</script><b>')
    expect(JSON.parse(JSON.stringify(m)).name).toBe('"}</script><b>')
  })
})

describe('containRect', () => {
  it('fits a wide logo inside the square, centred, with a margin', () => {
    const r = containRect(400, 100, 100)
    expect(r.width).toBeCloseTo(72)
    expect(r.height).toBeCloseTo(18)
    expect(r.x).toBeCloseTo(14)
    expect(r.y).toBeCloseTo(41)
  })
  it('fits a tall one and a square one', () => {
    expect(containRect(100, 400, 100).height).toBeCloseTo(72)
    const sq = containRect(50, 50, 100)
    expect(sq).toMatchObject({ x: 14, y: 14 })
    expect(sq.width).toBeCloseTo(72)
  })
  it('falls back to the whole square when the image has no size', () => {
    expect(containRect(0, 0, 180)).toEqual({ x: 0, y: 0, width: 180, height: 180 })
  })
})
