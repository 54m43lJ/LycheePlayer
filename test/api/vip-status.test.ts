import { beforeEach, describe, expect, it, vi } from 'vitest'

const { musicuMock, credentialState } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  credentialState: { value: { musicid: '1' } as { musicid: string } | null }
}))

vi.mock('../../src/main/api/client', () => ({
  UpstreamError: class UpstreamError extends Error {},
  musicu: musicuMock,
  upstreamRequest: vi.fn(),
  hash33: () => 0
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => credentialState.value
}))

beforeEach(() => {
  vi.resetModules()
  musicuMock.mockReset()
  credentialState.value = { musicid: String(Math.random()) }
})

describe('getVipStatus', () => {
  it('maps green diamond to vip and parses seconds expiry', async () => {
    musicuMock.mockResolvedValue({ identity: { vip: 1 }, userinfo: { expire: 2_000_000_000 } })
    const { getVipStatus } = await import('../../src/main/api/user')
    expect(await getVipStatus()).toEqual({
      state: 'known',
      isVip: true,
      level: 'vip',
      expiresAtMs: 2_000_000_000_000
    })
  })

  it('prefers svip over huge vip', async () => {
    musicuMock.mockResolvedValue({ identity: { huge_vip: 1 }, svip: 1 })
    const { getVipStatus } = await import('../../src/main/api/user')
    expect((await getVipStatus()).level).toBe('svip')
  })

  it('returns known non-vip for a successful non-member response', async () => {
    musicuMock.mockResolvedValue({ identity: {} })
    const { getVipStatus } = await import('../../src/main/api/user')
    expect(await getVipStatus()).toEqual({
      state: 'known',
      isVip: false,
      level: 'none',
      expiresAtMs: null
    })
  })

  it('returns unknown instead of false when the request fails', async () => {
    musicuMock.mockRejectedValue(new Error('network'))
    const { getVipStatus, isVipUser } = await import('../../src/main/api/user')
    expect(await getVipStatus()).toEqual({
      state: 'unknown',
      isVip: false,
      level: 'none',
      expiresAtMs: null
    })
    expect(await isVipUser()).toBeNull()
  })
})
