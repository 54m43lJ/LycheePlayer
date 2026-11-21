import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthStatus, LoginMethod, ReauthReason, UserProfile } from '@shared/types'
import { unwrap } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const method = ref<LoginMethod | null>(null)
  const musicid = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)
  const expiresAtMs = ref<number | null>(null)
  const canRefresh = ref(false)
  const reauthReason = ref<ReauthReason | null>(null)
  let dismissedReauthReason: ReauthReason | null = null

  const displayName = computed(() => profile.value?.nickname ?? (musicid.value ? `音乐 ID ${musicid.value}` : '未登录'))

  function applyStatus(status: AuthStatus): void {
    loggedIn.value = status.loggedIn
    method.value = status.method
    musicid.value = status.musicid
    expiresAtMs.value = status.expiresAtMs
    canRefresh.value = status.canRefresh
    if (status.loggedIn) {
      reauthReason.value = null
      dismissedReauthReason = null
      void loadProfile()
    } else {
      profile.value = null
      if (status.reauthReason) {
        if (status.reauthReason !== dismissedReauthReason) {
          reauthReason.value = status.reauthReason
        }
      } else {
        reauthReason.value = null
        dismissedReauthReason = null
      }
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
        canRefresh: false,
        reauthReason: null
      })
    } finally {
      ready.value = true
    }
  }

  async function loginWithCookie(cookie: string): Promise<void> {
    const status = unwrap(await window.lychee.login.loginWithCookie(cookie))
    applyStatus(status)
  }

  async function openWebLogin(loginMethod: LoginMethod): Promise<void> {
    const status = unwrap(await window.lychee.login.openWebLogin(loginMethod))
    applyStatus(status)
  }

  async function refreshSession(): Promise<void> {
    applyStatus(unwrap(await window.lychee.login.refreshSession()))
  }

  async function logout(): Promise<void> {
    unwrap(await window.lychee.login.logout())
    loggedIn.value = false
    method.value = null
    musicid.value = null
    profile.value = null
    expiresAtMs.value = null
    canRefresh.value = false
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
    canRefresh,
    reauthReason,
    refresh,
    dismissReauth,
    loginWithCookie,
    openWebLogin,
    refreshSession,
    logout
  }
})
