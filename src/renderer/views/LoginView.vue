<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { LoginMethod } from '@shared/types'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const method = ref<LoginMethod>('qq')
const embedFailed = ref(false)
const frameRef = ref<HTMLElement | null>(null)

let frameObserver: ResizeObserver | null = null
let loginSeq = 0

const avatarLetter = computed(() => auth.displayName.slice(0, 1).toUpperCase())
const reloadLabel = computed(() =>
  method.value === 'wechat' ? '重新加载微信登录' : '重新加载登录组件'
)

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

async function startEmbedLogin(loginMethod: LoginMethod = method.value): Promise<void> {
  const seq = ++loginSeq
  embedFailed.value = false
  try {
    await auth.openWebLogin(loginMethod)
    if (seq !== loginSeq) return
    toast.show('扫码登录成功')
    void router.replace('/library')
  } catch (err) {
    if (seq !== loginSeq) return
    clearBounds()
    embedFailed.value = true
    toast.error(describeError(err))
  }
}

function selectMethod(next: LoginMethod): void {
  if (next === method.value) return
  method.value = next
  embedFailed.value = false
  loginSeq += 1
  clearBounds()
  void nextTick(() => {
    sendBounds()
    void startEmbedLogin(next)
  })
}

function reloadEmbed(): void {
  loginSeq += 1
  clearBounds()
  void nextTick(() => {
    sendBounds()
    void startEmbedLogin()
  })
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
  loginSeq += 1
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
        <p class="faint">{{ auth.method === 'wechat' ? '微信扫码登录' : 'QQ 扫码登录' }}</p>
        <div style="display: flex; gap: 10px; justify-content: center">
          <button class="btn primary" @click="router.push('/library')">进入我的歌单</button>
          <button class="btn ghost" @click="auth.logout()">退出登录</button>
        </div>
      </div>
    </section>

    <section v-else class="login-card login-wide">
      <div class="login-methods" role="tablist" aria-label="登录方式">
        <button
          class="login-method"
          :class="{ active: method === 'qq' }"
          role="tab"
          :aria-selected="method === 'qq'"
          @click="selectMethod('qq')"
        >
          xlogin 扫码
        </button>
        <button
          class="login-method"
          :class="{ active: method === 'wechat' }"
          role="tab"
          :aria-selected="method === 'wechat'"
          @click="selectMethod('wechat')"
        >
          微信扫码
        </button>
      </div>

      <div
        ref="frameRef"
        class="embed-frame"
        :class="method === 'wechat' ? 'wechat' : 'qq'"
      ></div>
      <div v-if="embedFailed" class="embed-retry">
        <button class="btn ghost small" @click="reloadEmbed()">{{ reloadLabel }}</button>
      </div>
    </section>
  </div>
</template>
