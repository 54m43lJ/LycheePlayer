<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { Quality } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const auth = useAuthStore()
const player = usePlayerStore()
const router = useRouter()
const toast = useToast()

const QUALITIES: Array<{ value: Quality; label: string; hint: string }> = [
  { value: '128k', label: '标准', hint: '128 kbps MP3' },
  { value: '320k', label: '高品质', hint: '320 kbps MP3' },
  { value: 'flac', label: '无损', hint: 'FLAC · 需账号权限' }
]

async function chooseQuality(quality: Quality): Promise<void> {
  if (quality === settings.settings.defaultQuality) return
  try {
    await settings.update({ defaultQuality: quality })
    if (player.current) {
      player.setQuality(quality)
    } else {
      player.applySettings()
    }
    toast.show(`默认音质已切换为 ${QUALITIES.find((item) => item.value === quality)?.label}`)
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function toggleCloseToTray(): Promise<void> {
  try {
    await settings.update({ closeToTray: !settings.settings.closeToTray })
    toast.show(settings.settings.closeToTray ? '关闭窗口时最小化到托盘' : '关闭窗口时退出应用')
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
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Preferences</div>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">音质、窗口行为与登录状态。</p>
      </div>
    </div>

    <div class="settings-grid">
      <div style="display: flex; flex-direction: column; gap: 20px">
        <section class="panel">
          <div class="panel-head">
            <h2>播放</h2>
            <p>默认音质；无权限时上游会自动降一档重试。</p>
          </div>
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
                <span>{{ quality.hint }}</span>
              </button>
            </div>
            <p class="note" style="margin: 14px 0 0">
              播放中切换会立即重新获取链接；实际音质以账号权限和上游返回为准，降档结果会显示在播放条。
            </p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>窗口</h2>
            <p>POC 已包含托盘图标与右键菜单。</p>
          </div>
          <div class="panel-body">
            <div class="setting-row">
              <div>
                <div class="setting-name">关闭到托盘</div>
                <div class="setting-desc">关闭主窗口时隐藏而非退出；需从托盘菜单选择退出。</div>
              </div>
              <button
                class="switch"
                :class="{ on: settings.settings.closeToTray }"
                aria-label="切换关闭到托盘"
                @click="toggleCloseToTray()"
              />
            </div>
          </div>
        </section>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px">
        <section class="panel">
          <div class="panel-head">
            <h2>账号</h2>
            <p>凭证只保存在主进程，不跨 IPC 下发。</p>
          </div>
          <div class="panel-body">
            <template v-if="auth.loggedIn">
              <div class="setting-row">
                <div>
                  <div class="setting-name">{{ auth.displayName }}</div>
                  <div class="setting-desc mono">musicid {{ auth.musicid }}</div>
                </div>
                <span class="pay-badge" style="border-color: var(--accent-line); color: var(--accent-strong); background: var(--accent-soft)">已登录</span>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 16px">
                <button class="btn small" @click="router.push('/library')">我的歌单</button>
                <button class="btn ghost small" @click="logout()">
                  <AppIcon name="logout" :size="14" />
                  退出登录
                </button>
              </div>
            </template>
            <template v-else>
              <p class="note" style="margin: 0 0 14px">当前未登录。搜索与免费歌曲播放仍可使用。</p>
              <button class="btn primary small" @click="router.push('/login')">
                <AppIcon name="login" :size="14" />
                去登录
              </button>
            </template>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>关于 POC</h2>
            <p>验证上游接口与主进程 / 渲染进程边界。</p>
          </div>
          <div class="panel-body">
            <div class="setting-row">
              <span class="setting-name">版本</span>
              <span class="mono faint">0.1.0-poc</span>
            </div>
            <div class="setting-row">
              <span class="setting-name">音频引擎</span>
              <span class="faint">HTML5 Audio</span>
            </div>
            <div class="setting-row">
              <span class="setting-name">许可证</span>
              <span class="faint">Apache-2.0（待最终确认）</span>
            </div>
            <p class="note" style="margin: 14px 0 0">
              非官方客户端，与腾讯及 QQ 音乐无隶属关系；仅调用官方公开接口，不绕过授权。
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
