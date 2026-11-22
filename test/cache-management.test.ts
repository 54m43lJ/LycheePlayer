import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const state = vi.hoisted(() => ({ root: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: () => state.root,
    getAppPath: () => state.root
  },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

let root = ''

async function writeFileBytes(path: string, bytes: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, Buffer.alloc(bytes))
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'lychee-cache-'))
  state.root = root
  const playlistDir = join(root, 'cache', 'playlist')
  await mkdir(playlistDir, { recursive: true })
  await writeFile(join(playlistDir, '123-1.json'), 'a')
  await writeFile(join(playlistDir, '123-2.json'), 'bb')
  await writeFile(join(playlistDir, '456-1.json'), 'ccc')
  await writeFile(join(playlistDir, 'anonymous-liked.json'), 'dddd')
  await writeFileBytes(join(root, 'cache', 'audio', '123', '320k', 'a.mp3'), 10)
  await writeFileBytes(join(root, 'cache', 'audio', '123', 'flac', 'b.flac'), 20)
  await writeFileBytes(join(root, 'cache', 'audio', '456', '128k', 'c.mp3'), 30)
  await writeFile(join(root, 'cache', 'audio', 'README'), 'not a user dir')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('cache/user', () => {
  it('lists playlist and audio cache usage per account', async () => {
    const { listUserCaches } = await import('../../src/main/cache/user')
    const users = await listUserCaches()

    expect(users).toEqual([
      {
        musicid: '123',
        audioBytes: 30,
        audioFiles: 2,
        playlistBytes: 3,
        playlistFiles: 2
      },
      {
        musicid: '456',
        audioBytes: 30,
        audioFiles: 1,
        playlistBytes: 3,
        playlistFiles: 1
      },
      {
        musicid: 'anonymous',
        audioBytes: 0,
        audioFiles: 0,
        playlistBytes: 4,
        playlistFiles: 1
      }
    ])
  })

  it('deletes only the selected account from both cache roots', async () => {
    const { clearUserCache, listUserCaches } = await import('../../src/main/cache/user')

    await clearUserCache('123')

    const users = await listUserCaches()
    expect(users.map((user) => user.musicid)).toEqual(['456', 'anonymous'])
    expect((await readdir(join(root, 'cache', 'playlist'))).sort()).toEqual([
      '456-1.json',
      'anonymous-liked.json'
    ])
    expect((await readdir(join(root, 'cache', 'audio'))).sort()).toEqual(['456', 'README'])
  })

  it('keeps the anonymous scope when another account is cleared', async () => {
    const { clearUserCache, listUserCaches } = await import('../../src/main/cache/user')

    await clearUserCache('456')

    expect((await listUserCaches()).map((user) => user.musicid)).toEqual(['123', 'anonymous'])
  })
})
