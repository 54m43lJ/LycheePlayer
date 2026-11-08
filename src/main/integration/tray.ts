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
    const image = nativeImage.createFromPath(iconPath()).resize({ width: 22, height: 22 })
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
