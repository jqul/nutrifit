import { describe, expect, it } from 'vitest'
import { entryAssetOf, isNewVersion } from './appVersion'

const html = (hash: string) => `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-${hash}.js"></script><link rel="stylesheet" href="/assets/index-Zz9.css"></head><body><div id="root"></div></body></html>`

describe('entryAssetOf', () => {
  it('finds the main script of a built page', () => {
    expect(entryAssetOf(html('3lKyucrE'))).toBe('/assets/index-3lKyucrE.js')
    expect(entryAssetOf(html('a_b-C1'))).toBe('/assets/index-a_b-C1.js')
  })
  it('ignores the stylesheet and returns null when there is no main script (dev server, error page)', () => {
    expect(entryAssetOf('<link href="/assets/index-Zz9.css">')).toBeNull()
    expect(entryAssetOf('<script type="module" src="/src/main.tsx"></script>')).toBeNull()
    expect(entryAssetOf('The page could not be found')).toBeNull()
  })
})

describe('isNewVersion', () => {
  it('is true only when both are known and different', () => {
    expect(isNewVersion('/assets/index-A.js', '/assets/index-B.js')).toBe(true)
    expect(isNewVersion('/assets/index-A.js', '/assets/index-A.js')).toBe(false)
    expect(isNewVersion(null, '/assets/index-B.js')).toBe(false)
    expect(isNewVersion('/assets/index-A.js', null)).toBe(false)
  })
})
