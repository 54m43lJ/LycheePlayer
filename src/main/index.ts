import { app, BrowserWindow, dialog, Menu, safeStorage, shell } from 'electron'
import { join } from 'node:path'
import { SESSION_REFRESH_INTERVAL_MS } from '../shared/constants'
import { loadCredential } from './credential'
import { refreshIfNeeded } from './api/login'
import { registerIpc, sendPlayerCommand } from './ipc'
import { initMpris, publishState } from './integration/mpris'
import { destroyTray, initTray } from './integration/tray'
import { getSettings, loadSettings, saveSettings } from './settings'
import { disposeEmbedView, isAllowedHost } from './api/web-login'
import { registerAudioProtocol } from './media/audio-protocol'
import { applyFlagsFromDisk } from './startup-flags'
import { stopMpv } from './audio/mpv'

let mainWindow: BrowserWindow | null = null
let quitting = false
let refreshTimer: NodeJS.Timeout | null = null

app.setName('Lychee Player')
Menu.setApplicationMenu(null)

// 模块加载阶段：先应用内置默认，再叠加 flags 文件；显式命令行在 configureLinuxDisplay 中优先。
applyFlagsFromDisk()

/** Linux 默认 Wayland：检测到 WAYLAND_DISPLAY 时强制使用 Ozone Wayland 并启用 IME。 */
function configureLinuxDisplay(): void {
  if (process.platform !== 'linux') return
  if (process.argv.some((arg) => arg.startsWith('--ozone-platform'))) return
  if (app.commandLine.hasSwitch('ozone-platform')) return

  const override = process.env.LYCHEE_OZONE_PLATFORM
  if (override === 'x11') {
    app.commandLine.appendSwitch('ozone-platform', 'x11')
    return
  }
  if (override === 'wayland' || process.env.WAYLAND_DISPLAY) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland')
    app.commandLine.appendSwitch('enable-wayland-ime')
  }
}

configureLinuxDisplay()

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources/icon.png')
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#231F1F',
    title: 'Lychee Player',
    icon: iconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.once('ready-to-show', () => window.show())
  window.on('close', (event) => {
    if (!quitting && getSettings().closeToTray) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedHost(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { partition: 'lychee-xlogin', sandbox: true }
        }
      }
    }
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = window
  return window
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** 凭证依赖系统密钥环；不可用时明确报错并禁用登录，绝不退化为明文保存。 */
async function checkCredentialStore(): Promise<void> {
  if (safeStorage.isEncryptionAvailable()) return
  await dialog.showMessageBox({
    type: 'warning',
    title: '系统密钥环不可用',
    message: '无法加密保存登录凭证，登录功能已禁用。',
    detail:
      '请确认 gnome-keyring 或 ksecretsservice 已安装并解锁后重启应用。免费内容的搜索与播放不受影响。',
    buttons: ['知道了']
  })
}

export async function bootstrap(): Promise<void> {
  await checkCredentialStore()
  loadSettings()
  await loadCredential()
  registerAudioProtocol()
  registerIpc()

  initMpris(sendPlayerCommand)
  initTray({
    onShow: showMainWindow,
    onToggle: () => sendPlayerCommand('toggle'),
    onNext: () => sendPlayerCommand('next'),
    onPrevious: () => sendPlayerCommand('previous'),
    onQuit: () => app.quit()
  })

  createMainWindow()

  // 登录态续期：启动后检查一次，此后定时检查；密钥环晚解锁时重试解密。
  void refreshIfNeeded()
  refreshTimer = setInterval(() => {
    void (async () => {
      await loadCredential()
      await refreshIfNeeded()
    })()
  }, SESSION_REFRESH_INTERVAL_MS)
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(bootstrap).catch((err) => {
    console.error('[bootstrap]', err)
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    quitting = true
    if (refreshTimer) clearInterval(refreshTimer)
    publishState(null)
    destroyTray()
    disposeEmbedView()
    void stopMpv()
    void saveSettings(getSettings())
  })
}
