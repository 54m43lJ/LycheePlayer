import { app, safeStorage } from 'electron'
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Credential, ReauthReason } from '../shared/types'

interface StoredCredential {
  version: 2
  encrypted: boolean
  payload: string
}

let cached: Credential | null = null
let loaded = false
let resetReason: ReauthReason | null = null

function credentialFile(): string {
  return join(app.getPath('userData'), 'credential.bin')
}

function isValidCredential(value: unknown): value is Credential {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    (candidate.method === 'qq' || candidate.method === 'wechat') &&
    typeof candidate.musicid === 'string' &&
    candidate.musicid.length > 0 &&
    typeof candidate.musickey === 'string' &&
    candidate.musickey.length > 0 &&
    (candidate.expiredAtMs === null || typeof candidate.expiredAtMs === 'number')
  )
}

/** 主进程内部读取当前凭证，不跨 IPC。 */
export function getCredential(): Credential | null {
  return cached
}

/** v1 等旧格式被清空后，主进程通过该原因触发全局重新登录界面。 */
export function getReauthReason(): ReauthReason | null {
  return resetReason
}

/** 由续期状态机或 v1 读取链路设置失效原因；弹层只读取，不调用该入口。 */
export function setReauthReason(reason: ReauthReason | null): void {
  resetReason = reason
}

export async function loadCredential(): Promise<Credential | null> {
  if (loaded) return cached
  try {
    const raw = await readFile(credentialFile(), 'utf8')
    const stored = JSON.parse(raw) as { version?: unknown; encrypted?: unknown; payload?: unknown }

    // v1 是已经废弃的凭证格式：不迁移、不解密，直接删除并要求用户重新登录。
    if (stored.version === 1) {
      resetReason = 'v1'
      cached = null
      loaded = true
      await rm(credentialFile(), { force: true }).catch(() => undefined)
      console.info('[credential] 已清除 v1 凭证，需要重新登录')
      return null
    }

    if (
      stored.version !== 2 ||
      typeof stored.encrypted !== 'boolean' ||
      typeof stored.payload !== 'string'
    ) {
      return null
    }

    // 旧明文凭证只在密钥环可用时加载并重新加密；不可用则拒绝登录，不把明文载入内存。
    if (!stored.encrypted && !safeStorage.isEncryptionAvailable()) return null

    const json = stored.encrypted
      ? safeStorage.decryptString(Buffer.from(stored.payload, 'base64'))
      : Buffer.from(stored.payload, 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (!isValidCredential(parsed)) return null
    cached = parsed
    if (!stored.encrypted) {
      await saveCredential(parsed)
    }
    loaded = true
    return cached
  } catch {
    // 解密失败（常见于密钥环尚未解锁）：不缓存失败结果、保留文件，下次调用重试。
    return null
  }
}

export async function saveCredential(credential: Credential): Promise<void> {
  if (!isValidCredential(credential)) {
    throw new Error('拒绝保存无效凭证')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统密钥环不可用，拒绝以明文保存凭证')
  }
  const stored: StoredCredential = {
    version: 2,
    encrypted: true,
    payload: safeStorage.encryptString(JSON.stringify(credential)).toString('base64')
  }
  await mkdir(dirname(credentialFile()), { recursive: true })
  await writeFile(credentialFile(), JSON.stringify(stored), { mode: 0o600 })
  cached = credential
  resetReason = null
}

export async function clearCredential(): Promise<void> {
  cached = null
  loaded = true
  resetReason = null
  await rm(credentialFile(), { force: true })
}
