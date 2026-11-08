import { app, BrowserWindow } from 'electron'
import { spawn, execFile } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { chmod, rm } from 'node:fs/promises'
import { connect, type Socket } from 'node:net'
import { join } from 'node:path'
import type { MpvState } from '../../shared/types'
import { MPV_BINARY, MPV_SOCKET_PREFIX } from '../../shared/constants'

interface MpvResponse {
  request_id?: number
  error: 'success' | string
  data?: unknown
}

interface MpvEvent {
  event: string
  name?: string
  data?: unknown
}

interface Pending {
  resolve(value: unknown): void
  reject(error: Error): void
}

let mpvProcess: ChildProcessWithoutNullStreams | null = null
let socket: Socket | null = null
let socketPath = ''
let buffer = ''
let requestId = 1
let playing = false
let starting: Promise<void> | null = null
const pending = new Map<number, Pending>()
let availability: MpvState | null = null

function broadcast(event: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('mpv:event', event)
  }
}

function handleLine(line: string): void {
  if (!line.trim()) return
  let message: MpvResponse & MpvEvent
  try {
    message = JSON.parse(line) as MpvResponse & MpvEvent
  } catch {
    return
  }
  if (typeof message.request_id === 'number') {
    const waiter = pending.get(message.request_id)
    if (waiter) {
      pending.delete(message.request_id)
      if (message.error === 'success') waiter.resolve(message.data)
      else waiter.reject(new Error(`mpv: ${message.error}`))
    }
    return
  }
  if (message.event === 'property-change') {
    if (message.name === 'time-pos' && typeof message.data === 'number') {
      broadcast({ type: 'time', positionMs: Math.max(0, message.data * 1000) })
    } else if (message.name === 'duration' && typeof message.data === 'number') {
      broadcast({ type: 'duration', durationMs: Math.max(0, message.data * 1000) })
    } else if (message.name === 'pause') {
      playing = !message.data
      broadcast({ type: message.data ? 'pause' : 'play' })
    }
    return
  }
  if (message.event === 'playback-restart') {
    playing = true
    broadcast({ type: 'play' })
    return
  }
  if (message.event === 'file-loaded') {
    broadcast({ type: 'loaded' })
    return
  }
  if (message.event === 'end-file') {
    playing = false
    broadcast({ type: 'ended' })
    return
  }
  if (message.event === 'shutdown') {
    playing = false
  }
}

function wireSocket(connection: Socket): void {
  socket = connection
  buffer = ''
  connection.setEncoding('utf8')
  connection.on('data', (chunk: string) => {
    buffer += chunk
    for (;;) {
      const index = buffer.indexOf('\n')
      if (index < 0) break
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      handleLine(line)
    }
  })
  connection.on('error', () => {
    socket = null
    playing = false
    broadcast({ type: 'error' })
  })
  connection.on('close', () => {
    socket = null
    playing = false
  })
}

function waitForSocket(path: string, attempts = 50, delayMs = 100): Promise<Socket> {
  return new Promise((resolve, reject) => {
    let remaining = attempts
    const attempt = (): void => {
      const connection = connect(path)
      connection.once('connect', () => resolve(connection))
      connection.once('error', () => {
        remaining -= 1
        if (remaining <= 0) reject(new Error('mpv IPC 连接超时'))
        else setTimeout(attempt, delayMs)
      })
    }
    attempt()
  })
}

export async function isMpvAvailable(): Promise<MpvState> {
  if (availability) return availability
  const state = await new Promise<MpvState>((resolve) => {
    execFile(MPV_BINARY, ['--version'], { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve({ available: false, version: null, playing: false })
        return
      }
      const match = stdout.match(/mpv\s+([0-9][^\s]*)/i)
      resolve({ available: true, version: match?.[1] ?? null, playing })
    })
  })
  availability = state
  return state
}

export async function startMpv(): Promise<void> {
  if (socket && mpvProcess) return
  if (starting) return starting
  starting = (async () => {
    const state = await isMpvAvailable()
    if (!state.available) throw new Error('系统未安装 mpv')
    const runtime = process.env.XDG_RUNTIME_DIR || app.getPath('temp')
    socketPath = join(runtime, `${MPV_SOCKET_PREFIX}-${process.pid}.sock`)
    await rm(socketPath, { force: true }).catch(() => undefined)
    mpvProcess = spawn(MPV_BINARY, [
      '--idle=yes',
      '--no-video',
      '--no-terminal',
      '--force-window=no',
      '--audio-display=no',
      `--input-ipc-server=${socketPath}`
    ])
    mpvProcess.once('exit', () => {
      mpvProcess = null
      socket = null
      playing = false
      broadcast({ type: 'error' })
    })
    const connection = await waitForSocket(socketPath)
    await chmod(socketPath, 0o600).catch(() => undefined)
    wireSocket(connection)
    await mpvCommand('observe_property', [1, 'time-pos'])
    await mpvCommand('observe_property', [2, 'duration'])
    await mpvCommand('observe_property', [3, 'pause'])
  })()
  try {
    await starting
  } finally {
    starting = null
  }
}

export async function stopMpv(): Promise<void> {
  socket?.destroy()
  socket = null
  pending.clear()
  if (mpvProcess) {
    mpvProcess.kill('SIGTERM')
    mpvProcess = null
  }
  playing = false
  if (socketPath) await rm(socketPath, { force: true }).catch(() => undefined)
}

export function mpvCommand(command: string, args: unknown[] = []): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('mpv 未启动'))
      return
    }
    const id = requestId
    requestId += 1
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`mpv 命令超时：${command}`))
    }, 10_000)
    pending.set(id, {
      resolve(value) {
        clearTimeout(timer)
        resolve(value)
      },
      reject(error) {
        clearTimeout(timer)
        reject(error)
      }
    })
    socket.write(`${JSON.stringify({ command: [command, ...args], request_id: id })}\n`)
  })
}

export async function loadAndPlayMpv(url: string): Promise<void> {
  await startMpv()
  await mpvCommand('loadfile', [url, 'replace'])
  await mpvCommand('set_property', ['pause', false])
}

export async function mpvPlay(): Promise<void> {
  await mpvCommand('set_property', ['pause', false])
}

export async function mpvPause(): Promise<void> {
  await mpvCommand('set_property', ['pause', true])
}

export async function mpvSeek(positionMs: number): Promise<void> {
  await mpvCommand('seek', [Math.max(0, positionMs) / 1000, 'absolute'])
}

export async function mpvSetVolume(volume: number): Promise<void> {
  await mpvCommand('set_property', ['volume', Math.max(0, Math.min(1, volume)) * 100])
}

export async function getMpvState(): Promise<MpvState> {
  const state = await isMpvAvailable()
  return { ...state, playing: socket !== null && playing }
}
