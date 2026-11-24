import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  AuthStatus,
  LoginMethod,
  ReauthReason,
  RefreshState,
  UserProfile,
  VipStatus
} from '@shared/types'
import { unwrap } from '../api'

const KNOWN_NONE: VipStatus = {
  state: 'known',
  isVip: false,
  level: 'none',
  growthLevel: null,
  expiresAtMs: null
}

const VIP_UNKNOWN: VipStatus = {
  state: 'unknown',
  isVip: false,
  level: 'none',
  growthLevel: null,
  expiresAtMs: null
}

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const method = ref<LoginMethod | null>(null)
  const musicid = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)
  const expiresAtMs = ref<number | null>(null)
  const refreshState = ref<RefreshState>('ok')
  const reauthReason = ref<ReauthReason | null>(null)
  /** 账号会员状态；接口失败为 unknown，不能当作非会员。 */
  const vip = ref<VipStatus>(VIP_UNKNOWN)
  let dismissedReauthReason: ReauthReason | null = null
  let vipRequest = 0

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
      void loadVip()
    } else {
      profile.value = null
      vipRequest += 1
      vip.value = KNOWN_NONE
    }
  }

  /** 会员状态用于派生歌曲播放权限；失败时保持 unknown，避免把接口异常当作非会员。 */
  async function loadVip(): Promise<void> {
    const request = ++vipRequest
    try {
      const status = unwrap(await window.lychee.user.vipStatus())
      if (request === vipRequest) vip.value = status
    } catch {
      if (request === vipRequest) vip.value = VIP_UNKNOWN
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
    vipRequest += 1
    vip.value = KNOWN_NONE
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
    vip,
    loadVip,
    refresh,
    applyStatus,
    dismissReauth,
    openWebLogin,
    refreshSession,
    logout
  }
})
