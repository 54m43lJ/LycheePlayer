import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  AuthStatus,
  LoginMethod,
  ReauthReason,
  RefreshState,
  UserProfile
} from '@shared/types'
import { unwrap } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const method = ref<LoginMethod | null>(null)
  const musicid = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)
  const expiresAtMs = ref<number | null>(null)
  const refreshState = ref<RefreshState>('ok')
  const reauthReason = ref<ReauthReason | null>(null)
  let dismissedReauthReason: ReauthReason | null = null

  const displayName = computed(() => profile.value?.nickname ?? (musicid.value ? `音乐 ID ${musicid.value}` : '未登录'))

  function applyStatus(status: AuthStatus): void {
    const previousMusicid = musicid.value
    const wasAuthFailed = refreshState.value === 'auth-failed'
    loggedIn.value = status.loggedIn
    method.value = status.method
    musicid.value = status.musicid
    expiresAtMs.value = status.expiresAtMs
    refreshState.value = status.refreshState
    if (status.reauthReason === 'auth-failed' && !wasAuthFailed) {
      dismissedReauthReason = null
    }
    if (status.reauthReason) {
      if (status.reauthReason !== dismissedReauthReason) {
        reauthReason.value = status.reauthReason
      }
    } else {
      reauthReason.value = null
      dismissedReauthReason = null
    }
    if (status.loggedIn) {
      if (status.musicid !== previousMusicid || !profile.value) void loadProfile()
    } else {
      profile.value = null
    }
  }

  function dismissReauth(): void {
    dismissedReauthReason = reauthReason.value
    reauthReason.value = null
  }

  async function loadProfile(): Promise<void> {
    try {
      profile.value = unwrap(await window.lychee.user.getProfile())
    } catch {
      profile.value = null
    }
  }

  async function refresh(): Promise<void> {
    try {
      applyStatus(unwrap(await window.lychee.login.getStatus()))
    } catch {
      applyStatus({
        loggedIn: false,
        method: null,
        musicid: null,
        expiresAtMs: null,
        refreshState: 'ok',
        reauthReason: null
      })
    } finally {
      ready.value = true
    }
  }

  async function openWebLogin(loginMethod: LoginMethod): Promise<void> {
    const status = unwrap(await window.lychee.login.openWebLogin(loginMethod))
    applyStatus(status)
  }

  async function refreshSession(): Promise<void> {
    // 手动续期视为一次新的重新登录触发；失败时允许再次弹出。
    dismissedReauthReason = null
    applyStatus(unwrap(await window.lychee.login.refreshSession()))
  }

  async function logout(): Promise<void> {
    unwrap(await window.lychee.login.logout())
    loggedIn.value = false
    method.value = null
    musicid.value = null
    profile.value = null
    expiresAtMs.value = null
    refreshState.value = 'ok'
    reauthReason.value = null
    dismissedReauthReason = null
    window.dispatchEvent(new Event('lychee:logout'))
  }

  return {
    loggedIn,
    method,
    musicid,
    profile,
    ready,
    displayName,
    expiresAtMs,
    refreshState,
    reauthReason,
    refresh,
    applyStatus,
    dismissReauth,
    openWebLogin,
    refreshSession,
    logout
  }
})
