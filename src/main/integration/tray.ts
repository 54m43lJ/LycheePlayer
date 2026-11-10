import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import type { PlayerState } from '../../shared/types'

export interface TrayActions {
  onShow: () => void
  onToggle: () => void
  onNext: () => void
  onPrevious: () => void
  onQuit: () => void
}

let tray: Tray | null = null
let actions: TrayActions | null = null
let lastState: PlayerState | null = null
let lastTooltip = ''
let lastMenuKey = ''

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(app.getAppPath(), 'resources/tray.png')
}

/**
 * 托盘图标固定使用 22×22 全彩 PNG，不在运行时缩放。
 * 对 32×32 图标调用 resize 会在高 DPI 下生成额外的 2x 表示，
 * Electron 导出 StatusNotifierItem IconPixmap 时会采用 44×44；
 * 部分 Linux 托盘宿主只按 22×22 解析该 pixmap，会渲染成黑色。
 */
function loadTrayImage() {
  const image = nativeImage.createFromPath(iconPath())
  image.setTemplateImage(false)
  return image
}

function buildMenu(): Menu {
  const hasSong = Boolean(lastState?.song)
  const playing = lastState?.status === 'playing'
  return Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => actions?.onShow() },
    { type: 'separator' },
    {
      label: playing ? '暂停' : '播放',
      enabled: hasSong,
      click: () => actions?.onToggle()
    },
    { label: '上一首', enabled: hasSong, click: () => actions?.onPrevious() },
    { label: '下一首', enabled: hasSong, click: () => actions?.onNext() },
    { type: 'separator' },
    { label: '退出 Lychee Player', click: () => actions?.onQuit() }
  ])
}

function menuKey(state: PlayerState | null): string {
  return `${state?.song?.songMid ?? ''}|${state?.status ?? 'stopped'}`
}

export function initTray(handlers: TrayActions): void {
  try {
    actions = handlers
    const image = loadTrayImage()
    if (image.isEmpty()) {
      console.warn(`[tray] 托盘图标加载失败：${iconPath()}`)
      tray = null
      return
    }
    tray = new Tray(image)
    lastTooltip = 'Lychee Player'
    lastMenuKey = menuKey(null)
    tray.setToolTip(lastTooltip)
    tray.setContextMenu(buildMenu())
    tray.on('click', () => actions?.onShow())
  } catch {
    tray = null
  }
}

/** 同步菜单文案、可用状态与 tooltip；只在歌曲或播放状态变化时重建菜单。 */
export function updateTray(state: PlayerState | null): void {
  lastState = state
  if (!tray) return
  const song = state?.song
  const singer = song ? song.singers.map((item) => item.name).join(' / ') : ''
  const tooltip = song ? `${song.name}${singer ? ` — ${singer}` : ''}` : 'Lychee Player'
  if (tooltip !== lastTooltip) {
    lastTooltip = tooltip
    tray.setToolTip(tooltip)
  }
  const key = menuKey(state)
  if (key !== lastMenuKey) {
    lastMenuKey = key
    tray.setContextMenu(buildMenu())
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  actions = null
  lastState = null
  lastTooltip = ''
  lastMenuKey = ''
}
