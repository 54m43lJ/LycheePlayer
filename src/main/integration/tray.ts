import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'

export interface TrayActions {
  onShow: () => void
  onToggle: () => void
  onNext: () => void
  onPrevious: () => void
  onQuit: () => void
}

let tray: Tray | null = null

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(app.getAppPath(), 'resources/tray.png')
}

export function initTray(actions: TrayActions): void {
  try {
    const image = nativeImage.createFromPath(iconPath()).resize({ width: 22, height: 22 })
    tray = new Tray(image)
    tray.setToolTip('Lychee Player')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示主窗口', click: actions.onShow },
        { type: 'separator' },
        { label: '播放 / 暂停', click: actions.onToggle },
        { label: '上一首', click: actions.onPrevious },
        { label: '下一首', click: actions.onNext },
        { type: 'separator' },
        { label: '退出 Lychee Player', click: actions.onQuit }
      ])
    )
    tray.on('click', actions.onShow)
  } catch {
    tray = null
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
