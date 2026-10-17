import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthStatus, QrStatus, UserProfile } from '@shared/types'
import { describeError, unwrap } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const musicid = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)

  const qrImage = ref('')
  const qrStage = ref<QrStatus['stage'] | null>(null)
  const qrLoading = ref(false)
  const qrError = ref('')
  const qrExpiresAt = ref(0)

  const displayName = computed(() => profile.value?.nickname ?? (musicid.value ? `音乐 ID ${musicid.value}` : '未登录'))

  function applyStatus(status: AuthStatus): void {
    loggedIn.value = status.loggedIn
    musicid.value = status.musicid
    if (status.loggedIn) {
      void loadProfile()
    } else {
      profile.value = null
    }
  }

  async function loadProfile(): Promise<void> {
    try {
      profile.value = unwrap(await window.qqy.user.getProfile())
    } catch {
      profile.value = null
    }
  }

  async function refresh(): Promise<void> {
    try {
      applyStatus(unwrap(await window.qqy.login.getStatus()))
    } catch {
      applyStatus({ loggedIn: false, musicid: null })
    } finally {
      ready.value = true
    }
  }

  async function startQrLogin(): Promise<void> {
    qrLoading.value = true
    qrError.value = ''
    qrStage.value = 'waiting'
    try {
      const session = unwrap(await window.qqy.login.createQrKey())
      qrImage.value = session.imageDataUrl
      qrExpiresAt.value = session.expiresAtMs
      qrStage.value = 'waiting'
    } catch (err) {
      qrStage.value = 'expired'
      qrError.value = describeError(err)
    } finally {
      qrLoading.value = false
    }
  }

  function handleQrStatus(status: QrStatus): void {
    qrStage.value = status.stage
    if (status.message) qrError.value = status.message
    if (status.stage === 'ok') {
      qrImage.value = ''
      qrError.value = ''
      void refresh()
    }
  }

  async function loginWithCookie(cookie: string): Promise<void> {
    const status = unwrap(await window.qqy.login.loginWithCookie(cookie))
    applyStatus(status)
    qrStage.value = 'ok'
    qrImage.value = ''
  }

  async function logout(): Promise<void> {
    unwrap(await window.qqy.login.logout())
    loggedIn.value = false
    musicid.value = null
    profile.value = null
    qrStage.value = null
    qrImage.value = ''
    qrExpiresAt.value = 0
  }

  return {
    loggedIn,
    musicid,
    profile,
    ready,
    displayName,
    qrImage,
    qrStage,
    qrLoading,
    qrError,
    qrExpiresAt,
    refresh,
    startQrLogin,
    handleQrStatus,
    loginWithCookie,
    logout
  }
})
