<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const cookie = ref('')
const cookieSubmitting = ref(false)
const webLoginLoading = ref(false)
const now = ref(Date.now())
let ticker: number | undefined

const remaining = computed(() => {
  if (!auth.qrExpiresAt) return 0
  return Math.max(0, Math.ceil((auth.qrExpiresAt - now.value) / 1000))
})

const expired = computed(
  () => auth.qrStage === 'expired' || (Boolean(auth.qrImage) && remaining.value === 0)
)
const failed = computed(() => auth.qrStage === 'failed')

const statusText = computed(() => {
  if (auth.qrLoading) return '正在获取二维码…'
  if (!auth.qrImage && !auth.qrLoading) return auth.qrError || '点击刷新获取二维码'
  switch (auth.qrStage) {
    case 'scanned':
      return '已扫码，请在手机上确认登录'
    case 'ok':
      return '登录成功'
    case 'failed':
      return auth.qrError || '登录失败，请重试'
    case 'expired':
      return '二维码已过期'
    default:
      return `请使用手机 QQ 扫码${remaining.value > 0 ? ` · ${remaining.value}s` : ''}`
  }
})

const avatarLetter = computed(() => auth.displayName.slice(0, 1).toUpperCase())

onMounted(() => {
  ticker = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
  if (!auth.loggedIn && !auth.qrImage && !auth.qrLoading) {
    void auth.startQrLogin()
  }
})

onBeforeUnmount(() => {
  if (ticker) window.clearInterval(ticker)
})

watch(
  () => auth.qrStage,
  (stage) => {
    if (stage === 'ok') void router.replace('/library')
  }
)

async function submitCookie(): Promise<void> {
  if (!cookie.value.trim()) return
  cookieSubmitting.value = true
  try {
    await auth.loginWithCookie(cookie.value.trim())
    toast.show('Cookie 登录成功')
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    cookieSubmitting.value = false
  }
}

async function submitWebLogin(): Promise<void> {
  webLoginLoading.value = true
  try {
    await auth.openWebLogin()
    toast.show('网页登录成功')
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    webLoginLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <section v-if="auth.loggedIn" class="login-card" style="grid-template-columns: 1fr">
      <div class="login-body" style="text-align: center; padding: 48px 32px">
        <span class="user-avatar" style="width: 64px; height: 64px; margin: 0 auto 16px; font-size: 22px">
          <img v-if="auth.profile?.avatarUrl" :src="auth.profile.avatarUrl" alt="" />
          <template v-else>{{ avatarLetter }}</template>
        </span>
        <h1>已登录</h1>
        <p>
          {{ auth.displayName }}<br />
          <span class="mono faint">musicid {{ auth.musicid }}</span>
        </p>
        <div style="display: flex; gap: 10px; justify-content: center">
          <button class="btn primary" @click="router.push('/library')">进入我的歌单</button>
          <button class="btn ghost" @click="auth.logout()">退出登录</button>
        </div>
      </div>
    </section>

    <section v-else class="login-card">
      <div class="login-qr">
        <div class="qr-frame">
          <div v-if="auth.qrLoading" class="spinner lg" />
          <img v-else-if="auth.qrImage" :src="auth.qrImage" alt="QQ 登录二维码" />
          <div v-else class="qr-mask">
            <AppIcon name="qrcode" :size="26" />
            <span>{{ auth.qrError || '二维码未加载' }}</span>
            <button @click="auth.startQrLogin()">重新获取</button>
          </div>

          <div v-if="(expired || failed) && auth.qrImage" class="qr-mask">
            <AppIcon :name="failed ? 'close' : 'refresh'" :size="24" />
            <span>{{ failed ? auth.qrError || '登录失败' : '二维码已过期' }}</span>
            <button @click="auth.startQrLogin()">重新获取</button>
          </div>
        </div>
        <div
          class="qr-status"
          :class="{ ok: auth.qrStage === 'ok', error: failed }"
        >{{ statusText }}</div>
        <button
          class="btn small"
          :disabled="webLoginLoading"
          title="在独立窗口中打开 y.qq.com，完成扫码或安全验证后自动读取登录态"
          @click="submitWebLogin()"
        >
          <AppIcon name="login" :size="14" />
          {{ webLoginLoading ? '请在窗口中完成登录…' : '官方网页登录' }}
        </button>
        <p v-if="failed" class="note" style="text-align: center; max-width: 260px">
          扫码确认已收到但换取登录态失败。可展开下方 Cookie 登录先进入应用。
        </p>
        <p class="note" style="text-align: center; max-width: 250px">
          二维码由腾讯 QQ 登录服务签发，扫码后状态由主进程轮询，凭证不下发到界面。
        </p>
      </div>

      <div class="login-body">
        <div class="eyebrow">Sign in</div>
        <h1>登录 QQ 音乐</h1>
        <p>
          扫码登录是推荐方式。若二维码接口异常，可使用 Cookie 兜底登录；
          凭证会经 <span class="mono">safeStorage</span> 加密后写入本机用户目录。
        </p>

        <details class="cookie-box">
          <summary>使用 Cookie 登录（兜底）</summary>
          <p class="cookie-hint">
            在浏览器打开 <span class="mono">y.qq.com</span> 并登录，开发者工具 → Network →
            任选一个请求 → 复制 Request Headers 里的完整 Cookie，粘贴到下框。
          </p>
          <div class="field">
            <textarea
              v-model="cookie"
              class="textarea"
              spellcheck="false"
              placeholder="uin=o0123456789; qm_keyst=...; qqmusic_key=..."
            />
          </div>
          <button
            class="btn primary"
            style="margin-top: 10px"
            :disabled="cookieSubmitting || !cookie.trim()"
            @click="submitCookie()"
          >
            <AppIcon name="login" :size="15" />
            {{ cookieSubmitting ? '验证中…' : '使用 Cookie 登录' }}
          </button>
        </details>

        <div class="login-divider">POC 说明</div>
        <p class="note" style="margin: 0">
          本项目为非官方客户端，仅调用官方公开接口。VIP / 数字专辑内容只通过你本人的登录凭证获取，
          不实现任何绕过授权的能力。上游接口随时可能变更。
        </p>
      </div>
    </section>
  </div>
</template>
