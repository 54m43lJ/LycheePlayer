import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}))

const electron = vi.hoisted(() => ({
  getPath: vi.fn(() => '/tmp/lychee-test'),
  isEncryptionAvailable: vi.fn(() => true),
  decryptString: vi.fn(),
  encryptString: vi.fn(() => Buffer.from('encrypted'))
}))

vi.mock('node:fs/promises', () => fs)
vi.mock('electron', () => ({
  app: { getPath: electron.getPath },
  safeStorage: {
    isEncryptionAvailable: electron.isEncryptionAvailable,
    decryptString: electron.decryptString,
    encryptString: electron.encryptString
  }
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  fs.rm.mockResolvedValue(undefined)
  fs.mkdir.mockResolvedValue(undefined)
  fs.writeFile.mockResolvedValue(undefined)
  electron.isEncryptionAvailable.mockReturnValue(true)
})

describe('凭证存储', () => {
  it('clears a v1 credential without decrypting it and reports re-login', async () => {
    fs.readFile.mockResolvedValue(
      JSON.stringify({ version: 1, encrypted: true, payload: 'legacy' })
    )

    const credential = await import('../src/main/credential')
    await expect(credential.loadCredential()).resolves.toBeNull()

    expect(fs.rm).toHaveBeenCalledWith('/tmp/lychee-test/credential.bin', {
      force: true
    })
    expect(electron.decryptString).not.toHaveBeenCalled()
    expect(credential.getCredential()).toBeNull()
    expect(credential.getReauthReason()).toBe('v1')
  })

  it('does not report re-login for a normal missing credential', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'))

    const credential = await import('../src/main/credential')
    await expect(credential.loadCredential()).resolves.toBeNull()

    expect(fs.rm).not.toHaveBeenCalled()
    expect(credential.getReauthReason()).toBeNull()
  })
})
