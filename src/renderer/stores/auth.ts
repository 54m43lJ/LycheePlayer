import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthStatus, UserProfile } from '@shared/types'
import { unwrap } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const musicid = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)
  const expiresAtMs = ref<number | null>(null)
  const canRefresh = ref(false)

  const displayName = computed(() => profile.value?.nickname ?? (musicid.value ? `音乐 ID ${musicid.value}` : '未登录'))

  function applyStatus(status: AuthStatus): void {
    loggedIn.value = status.loggedIn
    musicid.value = status.musicid
    expiresAtMs.value = status.expiresAtMs
    canRefresh.value = status.canRefresh
    if (status.loggedIn) {
      void loadProfile()
    } else {
      profile.value = null
    }
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
      applyStatus({ loggedIn: false, musicid: null, expiresAtMs: null, canRefresh: false })
    } finally {
      ready.value = true
    }
  }

  async function loginWithCookie(cookie: string): Promise<void> {
    const status = unwrap(await window.lychee.login.loginWithCookie(cookie))
    applyStatus(status)
  }

  async function openWebLogin(): Promise<void> {
    const status = unwrap(await window.lychee.login.openWebLogin())
    applyStatus(status)
  }

  async function refreshSession(): Promise<void> {
    applyStatus(unwrap(await window.lychee.login.refreshSession()))
  }

  async function logout(): Promise<void> {
    unwrap(await window.lychee.login.logout())
    loggedIn.value = false
    musicid.value = null
    profile.value = null
    expiresAtMs.value = null
    canRefresh.value = false
  }

  return {
    loggedIn,
    musicid,
    profile,
    ready,
    displayName,
    expiresAtMs,
    canRefresh,
    refresh,
    loginWithCookie,
    openWebLogin,
    refreshSession,
    logout
  }
})
