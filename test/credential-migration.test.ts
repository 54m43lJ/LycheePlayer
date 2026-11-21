import { describe, expect, it } from 'vitest'
import { inferLoginMethod, normalizeCredential } from '../src/main/credential-migration'

describe('凭证迁移', () => {
  it('keeps v2 method unchanged', () => {
    expect(
      inferLoginMethod({ method: 'wechat', musickey: 'Q_H_L-key', loginType: 2 })
    ).toBe('wechat')
    expect(inferLoginMethod({ method: 'qq', musickey: 'W_X-key', loginType: 1 })).toBe(
      'qq'
    )
  })

  it('recognizes legacy WeChat credentials by loginType or musickey prefix', () => {
    expect(inferLoginMethod({ loginType: 1, musickey: 'Q_H_L-key' })).toBe('wechat')
    expect(inferLoginMethod({ musickey: 'W_X-key' })).toBe('wechat')
    expect(inferLoginMethod({ loginType: 2, musickey: 'Q_H_L-key' })).toBe('qq')
    expect(inferLoginMethod({ musickey: 'Q_H_L-key' })).toBe('qq')
  })

  it('normalizes a v1 credential without forcing re-login', () => {
    const credential = normalizeCredential({
      musicid: '100',
      musickey: 'W_X-key',
      expiredAtMs: null,
      refreshToken: 'refresh',
      loginType: 1
    })
    expect(credential).toMatchObject({
      method: 'wechat',
      musicid: '100',
      musickey: 'W_X-key',
      expiredAtMs: null,
      refreshToken: 'refresh'
    })
    expect(credential).not.toHaveProperty('loginType')
  })

  it('rejects incomplete credentials', () => {
    expect(normalizeCredential({ musicid: '', musickey: 'key', expiredAtMs: null })).toBeNull()
    expect(normalizeCredential({ musicid: '100', musickey: '', expiredAtMs: null })).toBeNull()
    expect(normalizeCredential({ musicid: '100', musickey: 'key' })).toBeNull()
  })
})
