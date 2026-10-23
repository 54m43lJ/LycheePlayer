<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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
const embedFailed = ref(false)
const frameRef = ref<HTMLElement | null>(null)

let frameObserver: ResizeObserver | null = null

const avatarLetter = computed(() => auth.displayName.slice(0, 1).toUpperCase())

/** 登录组件由主进程 WebContentsView 绘制；渲染端只上报占位区域（页面坐标），null 摘除。 */
function sendBounds(): void {
  const frame = frameRef.value
  if (!frame) return
  const rect = frame.getBoundingClientRect()
  window.lychee.login.setEmbedBounds({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  })
}

function clearBounds(): void {
  window.lychee.login.setEmbedBounds(null)
}

async function startEmbedLogin(): Promise<void> {
  embedFailed.value = false
  try {
    await auth.openWebLogin()
    toast.show('扫码登录成功')
    void router.replace('/library')
  } catch (err) {
    clearBounds()
    embedFailed.value = true
    toast.error(describeError(err))
  }
}

function reloadEmbed(): void {
  sendBounds()
  void startEmbedLogin()
}

async function submitCookie(): Promise<void> {
  if (!cookie.value.trim()) return
  cookieSubmitting.value = true
  try {
    await auth.loginWithCookie(cookie.value.trim())
    toast.show('Cookie 登录成功')
    void router.replace('/library')
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    cookieSubmitting.value = false
  }
}

onMounted(async () => {
  if (auth.loggedIn) return
  await nextTick()
  sendBounds()
  void startEmbedLogin()
  frameObserver = new ResizeObserver(sendBounds)
  if (frameRef.value) frameObserver.observe(frameRef.value)
  window.addEventListener('scroll', sendBounds, true)
})

onBeforeUnmount(() => {
  frameObserver?.disconnect()
  window.removeEventListener('scroll', sendBounds, true)
  clearBounds()
})
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
      <div ref="frameRef" class="embed-frame"></div>
      <div v-if="embedFailed" class="embed-retry">
        <button class="btn ghost small" @click="reloadEmbed()">重新加载登录组件</button>
      </div>

      <details class="cookie-box">
        <summary>使用 Cookie 登录（兜底）</summary>
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
