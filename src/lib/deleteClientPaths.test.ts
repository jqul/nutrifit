import { describe, it, expect } from 'vitest'
import { CLIENT_FILE_BUCKETS, chunk, isUuid, storagePathFromValue, uniquePaths } from '../../supabase/functions/delete-client/storagePaths'

describe('isUuid', () => {
  it('accepts uuids and rejects anything else', () => {
    expect(isUuid('3af51d9b-38b8-4e13-b846-f5149c2ff82c')).toBe(true)
    expect(isUuid('3AF51D9B-38B8-4E13-B846-F5149C2FF82C')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('../../etc/passwd')).toBe(false)
    expect(isUuid(42)).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})

describe('storagePathFromValue', () => {
  it('returns plain paths as they are, without a leading slash', () => {
    expect(storagePathFromValue('abc/meals/1.jpg', 'photos')).toBe('abc/meals/1.jpg')
    expect(storagePathFromValue('/abc/1.jpg', 'photos')).toBe('abc/1.jpg')
  })

  it('extracts the path from legacy public and signed URLs of that bucket', () => {
    const base = 'https://proj.supabase.co/storage/v1/object'
    expect(storagePathFromValue(`${base}/public/photos/abc/front_1.jpg`, 'photos')).toBe('abc/front_1.jpg')
    expect(storagePathFromValue(`${base}/sign/photos/abc/side%201.jpg?token=xyz`, 'photos')).toBe('abc/side 1.jpg')
  })

  it('ignores URLs that point to another bucket or to somewhere else', () => {
    expect(storagePathFromValue('https://proj.supabase.co/storage/v1/object/public/recipe-photos/x.jpg', 'photos')).toBeNull()
    expect(storagePathFromValue('https://example.com/foto.jpg', 'photos')).toBeNull()
  })

  it('ignores empty and non-string values', () => {
    expect(storagePathFromValue('', 'photos')).toBeNull()
    expect(storagePathFromValue('   ', 'photos')).toBeNull()
    expect(storagePathFromValue(null, 'photos')).toBeNull()
    expect(storagePathFromValue(undefined, 'photos')).toBeNull()
  })
})

describe('uniquePaths and chunk', () => {
  it('drops empty and repeated paths', () => {
    expect(uniquePaths(['a', null, 'b', 'a', undefined, ''])).toEqual(['a', 'b'])
  })
  it('splits a list into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})

describe('buckets', () => {
  it('covers the private buckets that hold client files, and nothing that belongs to the nutritionist', () => {
    expect([...CLIENT_FILE_BUCKETS]).toEqual(['photos', 'lab-reports'])
    expect([...CLIENT_FILE_BUCKETS]).not.toContain('consent-documents')
    expect([...CLIENT_FILE_BUCKETS]).not.toContain('recipe-photos')
  })
})

import { listFilesRecursive, StorageEntry } from '../../supabase/functions/delete-client/storagePaths'

// Un almacenamiento falso: carpetas con id nulo, ficheros con id.
const fakeStorage = (tree: Record<string, StorageEntry[]>) =>
  async (prefix: string, offset: number, limit: number) => (tree[prefix] ?? []).slice(offset, offset + limit)
const folder = (name: string): StorageEntry => ({ name, id: null })
const file = (name: string): StorageEntry => ({ name, id: `id-${name}` })

describe('listFilesRecursive', () => {
  it('walks subfolders and returns every file with its full path', async () => {
    const list = fakeStorage({
      c1: [folder('meals'), folder('s1'), file('front.jpg')],
      'c1/meals': [file('1.jpg'), file('2.jpg')],
      'c1/s1': [file('front_1.jpg'), folder('old')],
      'c1/s1/old': [file('x.jpg')],
    })
    expect((await listFilesRecursive(list, 'c1')).sort()).toEqual(['c1/front.jpg', 'c1/meals/1.jpg', 'c1/meals/2.jpg', 'c1/s1/front_1.jpg', 'c1/s1/old/x.jpg'])
  })

  it('pages through folders bigger than one page', async () => {
    const many = Array.from({ length: 7 }, (_, i) => file(`f${i}.jpg`))
    const out = await listFilesRecursive(fakeStorage({ c1: many }), 'c1', 3)
    expect(out).toHaveLength(7)
    expect(out[6]).toBe('c1/f6.jpg')
  })

  it('does not stop early when a full page ends exactly on the last file', async () => {
    const six = Array.from({ length: 6 }, (_, i) => file(`f${i}.jpg`))
    expect(await listFilesRecursive(fakeStorage({ c1: six }), 'c1', 3)).toHaveLength(6)
  })

  it('returns nothing for an empty or missing folder', async () => {
    expect(await listFilesRecursive(fakeStorage({}), 'nobody')).toEqual([])
  })

  it('propagates storage errors so deletion stops before touching the database', async () => {
    const failing = async () => { throw new Error('storage caído') }
    await expect(listFilesRecursive(failing, 'c1')).rejects.toThrow('storage caído')
  })
})

import { onlyUnderFolder } from '../../supabase/functions/delete-client/storagePaths'

describe('onlyUnderFolder', () => {
  const me = '3af51d9b-38b8-4e13-b846-f5149c2ff82c'
  it('keeps only paths inside the client folder', () => {
    expect(onlyUnderFolder([`${me}/meals/1.jpg`, `${me}/s1/front.jpg`], me)).toEqual([`${me}/meals/1.jpg`, `${me}/s1/front.jpg`])
  })
  it('drops paths that point at another client (a row can reference any path)', () => {
    expect(onlyUnderFolder(['otro-cliente/foto.jpg', `${me}/ok.jpg`], me)).toEqual([`${me}/ok.jpg`])
  })
  it('does not match a folder that merely starts with the same characters', () => {
    expect(onlyUnderFolder([`${me}-extra/foto.jpg`], me)).toEqual([])
  })
  it('drops path traversal', () => {
    expect(onlyUnderFolder([`${me}/../otro/foto.jpg`], me)).toEqual([])
  })
})
