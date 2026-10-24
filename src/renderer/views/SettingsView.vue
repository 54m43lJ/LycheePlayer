<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { FlagsFile, Settings } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { formatBytes } from '../utils/format'

const settings = useSettingsStore()
const auth = useAuthStore()
const player = usePlayerStore()
const router = useRouter()
const toast = useToast()
const sessionRefreshing = ref(false)
const appVersion = __APP_VERSION__
const appLicense = __APP_LICENSE__

const flags = ref<FlagsFile | null>(null)
const flagsDraft = ref('')
const flagsSaving = ref(false)
const storage = ref<{ directory: string; bytes: number; freeBytes: number; cacheBytes?: number; cacheFiles?: number } | null>(null)

const expiryText = computed(() => {
  if (!auth.loggedIn) return '未登录'
  if (!auth.expiresAtMs) return '未知（将定期续期）'
  return new Date(auth.expiresAtMs).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const QUALITIES: Array<{ value: Settings['defaultQuality']; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: '128k', label: '标准' },
  { value: '320k', label: '高品质' },
  { value: 'flac', label: '无损' }
]

const THEMES: Array<{ value: Settings['theme']; label: string }> = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' }
]

const ENGINES: Array<{ value: 'auto' | 'html5' | 'mpv'; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'html5', label: 'HTML5' },
  { value: 'mpv', label: 'mpv' }
]

const engineLabel = computed(() => {
  const engine = settings.settings.audioEngine ?? 'auto'
  if (engine === 'mpv') return 'mpv'
  if (engine === 'html5') return 'HTML5 Audio'
  return '自动（优先 mpv）'
})

async function loadFlags(): Promise<void> {
  try {
    flags.value = unwrap(await window.lychee.flags.get())
    flagsDraft.value = flags.value.content
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function loadStorage(): Promise<void> {
  try {
    storage.value = unwrap(await window.lychee.download.storage())
  } catch {
    storage.value = null
  }
}

async function saveFlags(): Promise<void> {
  flagsSaving.value = true
  try {
    unwrap(await window.lychee.flags.save(flagsDraft.value))
    toast.show('启动参数已保存，下次启动生效')
    await loadFlags()
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    flagsSaving.value = false
  }
}

async function chooseQuality(quality: Settings['defaultQuality']): Promise<void> {
  if (quality === settings.settings.defaultQuality) return
  try {
    await settings.update({ defaultQuality: quality })
    player.applySettings()
    if (player.current) player.setQuality(player.defaultQuality)
    toast.show(`默认音质已切换为 ${QUALITIES.find((item) => item.value === quality)?.label}`)
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function toggleCloseToTray(): Promise<void> {
  try {
    await settings.update({ closeToTray: !settings.settings.closeToTray })
    toast.show(settings.settings.closeToTray ? '关闭窗口时隐藏到托盘' : '关闭窗口时退出应用')
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function toggleAudioCache(): Promise<void> {
  try {
    await settings.update({ audioCacheEnabled: !settings.settings.audioCacheEnabled })
    await loadStorage()
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function chooseTheme(theme: Settings['theme']): Promise<void> {
  if (theme === settings.settings.theme) return
  try {
    await settings.update({ theme })
    toast.show(theme === 'light' ? '已切换到浅色模式' : '已切换到深色模式')
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function chooseEngine(engine: 'auto' | 'html5' | 'mpv'): Promise<void> {
  try {
    if (engine === 'mpv') {
      const state = unwrap(await window.lychee.mpv.getState())
      if (!state.available) {
        toast.error('未检测到 mpv，已回退 HTML5 Audio')
        await settings.update({ audioEngine: 'html5' })
        player.applySettings()
        return
      }
      unwrap(await window.lychee.mpv.setEnabled(true))
    } else if (engine === 'html5') {
      unwrap(await window.lychee.mpv.setEnabled(false))
    }
    await settings.update({ audioEngine: engine })
    player.applySettings()
    toast.show(`音频引擎已切换为 ${ENGINES.find((item) => item.value === engine)?.label}`)
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function clearCache(): Promise<void> {
  try {
    unwrap(await window.lychee.download.clearCache())
    await loadStorage()
    toast.show('播放缓存已清空')
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function chooseDownloadDir(): Promise<void> {
  try {
    const path = unwrap(await window.lychee.download.chooseFolder())
    if (!path) return
    await settings.update({ downloadDir: path })
    await loadStorage()
    toast.show('下载目录已更新')
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function logout(): Promise<void> {
  try {
    await auth.logout()
    toast.show('已退出登录')
    void router.push('/login')
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function refreshSession(): Promise<void> {
  sessionRefreshing.value = true
  try {
    await auth.refreshSession()
    toast.show('会话已续期')
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    sessionRefreshing.value = false
  }
}

onMounted(() => {
  void loadFlags()
  void loadStorage()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Preferences</div>
        <h1 class="page-title">设置</h1>
      </div>
    </div>

    <div class="settings-grid">
      <div class="settings-column">
        <section class="panel">
          <div class="panel-head"><h2>播放</h2></div>
          <div class="panel-body">
            <div class="quality-options">
              <button
                v-for="quality in QUALITIES"
                :key="quality.value"
                class="quality-option"
                :class="{ active: settings.settings.defaultQuality === quality.value }"
                @click="chooseQuality(quality.value)"
              >
                <strong>{{ quality.label }}</strong>
              </button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>外观</h2></div>
          <div class="panel-body">
            <div class="theme-options">
              <button
                v-for="theme in THEMES"
                :key="theme.value"
                class="quality-option"
                :class="{ active: settings.settings.theme === theme.value }"
                @click="chooseTheme(theme.value)"
              >
                <strong>{{ theme.label }}</strong>
              </button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>窗口</h2></div>
          <div class="panel-body">
            <div class="setting-row">
              <div><div class="setting-name">关闭到托盘</div></div>
              <button
                class="switch"
                :class="{ on: settings.settings.closeToTray }"
                aria-label="切换关闭到托盘"
                @click="toggleCloseToTray()"
              />
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>启动参数</h2>
            <span class="faint mono">{{ flags?.path ?? '加载中' }}</span>
          </div>
          <div class="panel-body">
            <textarea
              v-model="flagsDraft"
              class="textarea mono flags-editor"
              spellcheck="false"
              placeholder="# 每行一个启动参数"
            />
            <div class="panel-actions">
              <button class="btn small" :disabled="flagsSaving" @click="saveFlags()">
                {{ flagsSaving ? '保存中' : '保存' }}
              </button>
              <span class="faint">保存后下次启动生效</span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>缓存与下载</h2></div>
          <div class="panel-body">
            <div class="setting-row">
              <div>
                <div class="setting-name">播放缓存</div>
                <div class="setting-desc">
                  {{ storage ? `${formatBytes(storage.cacheBytes ?? 0)} · ${storage.cacheFiles ?? 0} 个文件` : '统计中' }}
                </div>
              </div>
              <div class="panel-actions">
                <button class="btn ghost small" @click="clearCache()">清空</button>
                <button
                  class="switch"
                  :class="{ on: settings.settings.audioCacheEnabled }"
                  aria-label="切换播放缓存"
                  @click="toggleAudioCache()"
                />
              </div>
            </div>
            <div class="setting-row">
              <div>
                <div class="setting-name">下载目录</div>
                <div class="setting-desc mono">{{ storage?.directory ?? settings.settings.downloadDir ?? '默认目录' }}</div>
                <div class="setting-desc" v-if="storage">
                  已用 {{ formatBytes(storage.bytes) }} · 剩余 {{ formatBytes(storage.freeBytes) }}
                </div>
              </div>
              <button class="btn small" @click="chooseDownloadDir()">选择</button>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-column">
        <section class="panel">
          <div class="panel-head"><h2>账号</h2></div>
          <div class="panel-body">
            <template v-if="auth.loggedIn">
              <div class="setting-row">
                <div>
                  <div class="setting-name">{{ auth.displayName }}</div>
                  <div class="setting-desc mono">musicid {{ auth.musicid }}</div>
                </div>
                <span class="pay-badge">已登录</span>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-name">凭证到期</div>
                  <div class="setting-desc">{{ expiryText }}</div>
                </div>
                <button class="btn small" :disabled="sessionRefreshing || !auth.canRefresh" @click="refreshSession()">
                  {{ sessionRefreshing ? '续期中…' : '立即续期' }}
                </button>
              </div>
              <div class="panel-actions">
                <button class="btn small" @click="router.push('/library')">我的歌单</button>
                <button class="btn ghost small" @click="logout()">
                  <AppIcon name="logout" :size="14" />
                  退出登录
                </button>
              </div>
            </template>
            <template v-else>
              <button class="btn primary small" @click="router.push('/login')">
                <AppIcon name="login" :size="14" />
                去登录
              </button>
            </template>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>关于</h2></div>
          <div class="panel-body">
            <div class="setting-row"><span class="setting-name">版本</span><span class="mono faint">{{ appVersion }}</span></div>
            <div class="setting-row"><span class="setting-name">音频引擎</span><span class="faint">{{ engineLabel }}</span></div>
            <div class="setting-row"><span class="setting-name">许可证</span><span class="faint">{{ appLicense }}</span></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>音频引擎</h2></div>
          <div class="panel-body">
            <div class="quality-options">
              <button
                v-for="engine in ENGINES"
                :key="engine.value"
                class="quality-option"
                :class="{ active: (settings.settings.audioEngine ?? 'auto') === engine.value }"
                @click="chooseEngine(engine.value)"
              >
                <strong>{{ engine.label }}</strong>
              </button>
            </div>
            <div class="setting-row">
              <span class="setting-name">EQ</span>
              <span class="faint">仅 mpv 引擎生效</span>
            </div>
            <div class="setting-row">
              <span class="setting-name">响度归一</span>
              <span class="faint">仅 mpv 引擎生效</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
