import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readPersistedJson } from '../src/renderer/utils/persisted-cache'

let storage: Map<string, string>

beforeEach(() => {
  storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  })
})

interface Entry {
  value: number
}

function isEntry(value: unknown): value is Entry {
  return Boolean(value) && typeof (value as Entry).value === 'number'
}

describe('readPersistedJson', () => {
  it('returns a valid cached value', () => {
    storage.set('key', JSON.stringify({ value: 1 }))
    expect(readPersistedJson('key', isEntry)).toEqual({ value: 1 })
  })

  it('removes the key when the structure does not match', () => {
    storage.set('key', JSON.stringify({ value: '1' }))
    expect(readPersistedJson('key', isEntry)).toBeNull()
    expect(storage.has('key')).toBe(false)
  })

  it('removes the key when JSON parsing fails', () => {
    storage.set('key', '{')
    expect(readPersistedJson('key', isEntry)).toBeNull()
    expect(storage.has('key')).toBe(false)
  })

  it('returns null without a stored value', () => {
    expect(readPersistedJson('missing', isEntry)).toBeNull()
  })
})
