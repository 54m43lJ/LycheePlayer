import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AuthStatus } from '../src/shared/types'

function status(overrides: Partial<AuthStatus> = {}): AuthStatus {
  return {
    loggedIn: true,
    method: 'qq',
    musicid: '100',
    expiresAtMs: null,
    refreshState: 'ok',
    reauthReason: null,
    ...overrides
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('window', {
    lychee: {
      user: {
        getProfile: async () => ({
          ok: true,
          data: { nickname: 'tester', avatarUrl: '' }
        })
      }
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auth store 重新登录状态', () => {
  it('shows auth-failed even while the credential is retained', async () => {
    const { useAuthStore } = await import('../src/renderer/stores/auth')
    const auth = useAuthStore()

    auth.applyStatus(
      status({ refreshState: 'auth-failed', reauthReason: 'auth-failed' })
    )

    expect(auth.loggedIn).toBe(true)
    expect(auth.refreshState).toBe('auth-failed')
    expect(auth.reauthReason).toBe('auth-failed')

    auth.dismissReauth()
    expect(auth.reauthReason).toBeNull()

    auth.applyStatus(
      status({ refreshState: 'auth-failed', reauthReason: 'auth-failed' })
    )
    expect(auth.reauthReason).toBeNull()

    auth.applyStatus(status({ loggedIn: false, reauthReason: 'v1' }))
    expect(auth.reauthReason).toBe('v1')
  })

  it('clears the dialog after a successful login', async () => {
    const { useAuthStore } = await import('../src/renderer/stores/auth')
    const auth = useAuthStore()

    auth.applyStatus(status({ reauthReason: 'auth-failed' }))
    expect(auth.reauthReason).toBe('auth-failed')

    auth.applyStatus(status({ refreshState: 'ok', reauthReason: null }))
    expect(auth.reauthReason).toBeNull()
    expect(auth.refreshState).toBe('ok')
  })
})
