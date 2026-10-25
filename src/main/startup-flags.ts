import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { FlagsFile, StartupFlag } from '../shared/types'
import { STARTUP_FLAGS_MAX_BYTES, STARTUP_FLAGS_MAX_LINES } from '../shared/constants'

const FLAGS_FILE_NAME = 'flags.conf'
const FLAGS_FILE_SWITCH = '--flags-file'

/** 默认 flags 文件路径：$XDG_CONFIG_HOME/lychee-player/flags.conf。 */
function defaultFlagsFile(): string {
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(configHome, 'lychee-player', FLAGS_FILE_NAME)
}

/** 从命令行解析 --flags-file=<path>；显式命令行高于文件。 */
export function resolveFlagsFile(argv: string[]): string {
  for (const arg of argv) {
    if (arg === FLAGS_FILE_SWITCH) continue
    if (arg.startsWith(`${FLAGS_FILE_SWITCH}=`)) {
      const value = arg.slice(FLAGS_FILE_SWITCH.length + 1).trim()
      if (value) return value
    }
  }
  return defaultFlagsFile()
}

/** 每行一个参数；空行与 # 开头行忽略。超出行数/字节时截断。 */
export function parseFlagsFile(text: string): StartupFlag[] {
  const capped = Buffer.from(text, 'utf8').subarray(0, STARTUP_FLAGS_MAX_BYTES).toString('utf8')
  const flags: StartupFlag[] = []
  for (const rawLine of capped.split(/\r?\n/)) {
    if (flags.length >= STARTUP_FLAGS_MAX_LINES) break
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (!line.startsWith('-')) continue
    const equals = line.indexOf('=')
    if (equals > 2) {
      const name = line.slice(0, equals).trim()
      const value = line.slice(equals + 1).trim()
      flags.push({ kind: 'argument', name, value, raw: line })
    } else {
      flags.push({ kind: 'switch', name: line, raw: line })
    }
  }
  return flags
}

/** 显式命令行中的同名 switch 优先级高于 flags 文件。 */
function isExplicitSwitch(name: string): boolean {
  return process.argv.some((arg) => arg === name || arg.startsWith(`${name}=`))
}

/** 将 flags 应用到 Chromium 命令行；--flags-file 由应用消费，不下发。 */
export function applyStartupFlags(flags: StartupFlag[]): void {
  const seen = new Set<string>()
  for (const flag of flags) {
    if (!flag.name || flag.name === FLAGS_FILE_SWITCH) continue
    if (!/^--[A-Za-z0-9][A-Za-z0-9-]*$/.test(flag.name)) continue
    if (isExplicitSwitch(flag.name)) continue
    if (seen.has(flag.name)) continue
    seen.add(flag.name)
    if (flag.kind === 'argument' && flag.value !== undefined) {
      app.commandLine.appendSwitch(flag.name.slice(2), flag.value)
    } else {
      app.commandLine.appendSwitch(flag.name.slice(2))
    }
  }
}

/** 内置默认：密钥环后端与自动播放策略；不覆盖命令行或 flags 文件已设置的同名 switch。 */
export function applyDefaultFlags(): void {
  const defaults: Array<[string, string]> = [
    ['password-store', 'gnome-libsecret'],
    ['autoplay-policy', 'no-user-gesture-required']
  ]
  for (const [name, value] of defaults) {
    if (app.commandLine.hasSwitch(name)) continue
    app.commandLine.appendSwitch(name, value)
  }
}

export async function readFlagsFile(): Promise<FlagsFile> {
  const path = resolveFlagsFile(process.argv)
  try {
    const content = await readFile(path, 'utf8')
    return { path, content }
  } catch {
    return { path, content: '' }
  }
}

export async function writeFlagsFile(content: string): Promise<void> {
  if (Buffer.byteLength(content, 'utf8') > STARTUP_FLAGS_MAX_BYTES) {
    throw new Error(`启动参数文件不能超过 ${STARTUP_FLAGS_MAX_BYTES} 字节`)
  }
  const path = resolveFlagsFile(process.argv)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, { mode: 0o600 })
}

/** 模块加载阶段同步读取并应用 flags 文件；读取失败时只保留默认值。 */
export function applyFlagsFromDisk(): void {
  let flags: StartupFlag[] = []
  try {
    flags = parseFlagsFile(readFileSync(resolveFlagsFile(process.argv), 'utf8'))
  } catch {
    // 文件不可读时只保留内置默认；应用继续启动。
  }
  // 先文件、后默认；文件入口跳过显式命令行，默认入口跳过已有 switch，
  // 保证显式命令行 > 文件 > 默认。
  applyStartupFlags(flags)
  applyDefaultFlags()
}
