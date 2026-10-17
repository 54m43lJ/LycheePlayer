import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { loadCredential } from './credential'
import { registerIpc, sendPlayerCommand } from './ipc'
import { initMpris, publishState } from './integration/mpris'
import { destroyTray, initTray } from './integration/tray'
import { getSettings, loadSettings, saveSettings } from './settings'

let mainWindow: BrowserWindow | null = null
let quitting = false

app.setName('qqy')
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
    minWidth: 680,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e12',
    title: 'qqy',
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

export async function bootstrap(): Promise<void> {
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
    publishState(null)
    destroyTray()
    void saveSettings(getSettings())
  })
}
