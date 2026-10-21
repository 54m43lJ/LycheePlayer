import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron'
import { join } from 'node:path'
import { loadCredential } from './credential'
import { refreshIfNeeded } from './api/login'
import { registerIpc, sendPlayerCommand } from './ipc'
import { initMpris, publishState } from './integration/mpris'
import { destroyTray, initTray } from './integration/tray'
import { getSettings, loadSettings, saveSettings } from './settings'
import { disposeEmbedView, isAllowedHost } from './api/web-login'

let mainWindow: BrowserWindow | null = null
let quitting = false
let refreshTimer: NodeJS.Timeout | null = null

// 推荐值 30 × 60_000 ms；会话续期定时器间隔。
const SESSION_REFRESH_INTERVAL_MS = 30 * 60_000

app.setName('Lychee Player')

// Hyprland 等非 GNOME/KDE 桌面下 Chromium 的后端自动探测会落到 basic_text，显式固定 libsecret 后端。
// 后续由外部 flags 文件覆盖（TODO）。
app.commandLine.appendSwitch('password-store', 'gnome-libsecret')


/**
 * Linux 默认 Wayland：检测到 WAYLAND_DISPLAY 时强制使用 Ozone Wayland，
 * 并启用 Wayland IME；无 Wayland 会话时保持 Electron 默认（通常为 X11）。
 * 可用 LYCHEE_OZONE_PLATFORM=x11/wayland 或命令行 --ozone-platform 覆盖。
 */
function configureLinuxDisplay(): void {
  if (process.platform !== 'linux') return
  if (process.argv.some((arg) => arg.startsWith('--ozone-platform'))) return

  const override = process.env.LYCHEE_OZONE_PLATFORM
  if (override === 'x11') {
    app.commandLine.appendSwitch('ozone-platform', 'x11')
    return
  }
  if (override === 'wayland' || process.env.WAYLAND_DISPLAY) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland')
    app.commandLine.appendSwitch('enable-wayland-ime')
    console.info('[startup] Ozone Wayland enabled')
  }
}

configureLinuxDisplay()
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources/icon.png')
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 280,
    minHeight: 440,
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

  // 登录态续期：启动后检查一次，此后每 30 分钟检查，到期前 10 分钟自动换新 musickey。
  void refreshIfNeeded()
  refreshTimer = setInterval(() => {
    void (async () => {
      // 密钥环晚解锁时，借定时检查重试解密后再续期。
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
    void saveSettings(getSettings())
  })
}
