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

  it('falls back to identity.overdate when userinfo.expire is unavailable', async () => {
    musicuMock.mockResolvedValue({
      identity: { vip: 1, overdate: '2027-03-16 10:43:22' },
      userinfo: { expire: -1 }
    })
    const { getVipStatus } = await import('../../src/main/api/user')
    expect((await getVipStatus()).expiresAtMs).toBe(
      Date.parse('2027-03-16T10:43:22+08:00')
    )
  })

  it('maps svip to 豪华绿钻 without HugeVip', async () => {
    musicuMock.mockResolvedValue({ identity: { vip: 1, HugeVip: 0 }, svip: 1 })
    const { getVipStatus } = await import('../../src/main/api/user')
    expect((await getVipStatus()).level).toBe('huge_vip')
  })

  it('maps HugeVip to 超级会员 and lets it win over 豪华绿钻', async () => {
    musicuMock.mockResolvedValue({
      identity: {
        vip: 1,
        HugeVip: 1,
        HugeVipEnd: '2027-02-24 00:24:11',
        overdate: '2027-03-16 10:43:22'
      },
      svip: 1
    })
    const { getVipStatus } = await import('../../src/main/api/user')
    const status = await getVipStatus()
    expect(status.level).toBe('svip')
    expect(status.expiresAtMs).toBe(Date.parse('2027-02-24T00:24:11+08:00'))
  })

  it('uses overdate for 豪华绿钻 when HugeVip is absent', async () => {
    musicuMock.mockResolvedValue({
      identity: { vip: 1, HugeVip: 0, overdate: '2027-03-16 10:43:22' },
      svip: 1
    })
    const { getVipStatus } = await import('../../src/main/api/user')
    const status = await getVipStatus()
    expect(status.level).toBe('huge_vip')
    expect(status.expiresAtMs).toBe(Date.parse('2027-03-16T10:43:22+08:00'))
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
