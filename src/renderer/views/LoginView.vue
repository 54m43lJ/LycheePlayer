<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const avatarLetter = computed(() => auth.displayName.slice(0, 1).toUpperCase())

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
    toast.show('扫码登录成功')
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
        <div class="qr-placeholder">
          <AppIcon name="qrcode" :size="86" />
        </div>
        <div class="qr-status">使用手机 QQ 扫描官方窗口中的二维码</div>
        <button class="btn primary" :disabled="webLoginLoading" @click="submitWebLogin()">
          <AppIcon name="login" :size="15" />
          {{ webLoginLoading ? '请在官方窗口中完成扫码…' : '打开官方扫码窗口' }}
        </button>
        <p class="note" style="text-align: center; max-width: 270px">
          只加载 QQ 官方登录组件，不加载完整网页。扫码确认后应用自动读取登录态并加密保存。
        </p>
      </div>

      <div class="login-body">
        <div class="eyebrow">Sign in</div>
        <h1>登录 QQ 音乐</h1>
        <p>
          登录由 QQ 官方扫码窗口完成，可处理设备锁与安全验证。若窗口无法使用，可展开下方的
          Cookie 兜底入口；凭证会经 <span class="mono">safeStorage</span> 加密后写入本机用户目录。
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
