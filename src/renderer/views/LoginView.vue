<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { XLOGIN_URL } from '@shared/xlogin'
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const cookie = ref('')
const cookieSubmitting = ref(false)
const embedFailed = ref(false)
const reloadKey = ref(0)

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

/** webview 挂载完成即开始换证监听；失败后可经 reloadEmbed 重新加载组件重试。 */
async function startEmbedLogin(): Promise<void> {
  embedFailed.value = false
  try {
    await auth.openWebLogin()
    toast.show('扫码登录成功')
  } catch (err) {
    embedFailed.value = true
    toast.error(describeError(err))
  }
}

function reloadEmbed(): void {
  reloadKey.value += 1
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

    <section v-else class="login-card login-wide">
      <div class="embed-frame">
        <webview
          :key="reloadKey"
          :src="XLOGIN_URL"
          partition="lychee-xlogin"
          allowpopups
          @dom-ready="startEmbedLogin()"
        />
      </div>
      <div v-if="embedFailed" class="embed-retry">
        <button class="btn ghost small" @click="reloadEmbed()">重新加载登录组件</button>
      </div>

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
    </section>
  </div>
</template>
