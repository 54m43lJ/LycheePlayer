import { app, safeStorage } from 'electron'
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Credential } from '../shared/types'
import { normalizeCredential } from './credential-migration'

interface StoredCredential {
  version: 1 | 2
  encrypted: boolean
  payload: string
}

let cached: Credential | null = null
let loaded = false

function credentialFile(): string {
  return join(app.getPath('userData'), 'credential.bin')
}

/** 主进程内部读取当前凭证，不跨 IPC。 */
export function getCredential(): Credential | null {
  return cached
}

export async function loadCredential(): Promise<Credential | null> {
  if (loaded) return cached
  try {
    const raw = await readFile(credentialFile(), 'utf8')
    const stored = JSON.parse(raw) as StoredCredential
    if (
      (stored.version !== 1 && stored.version !== 2) ||
      typeof stored.payload !== 'string'
    ) {
      return null
    }

    // 旧明文凭证只在密钥环可用时加载并迁移；不可用则拒绝登录，不把明文载入内存。
    if (!stored.encrypted && !safeStorage.isEncryptionAvailable()) return null

    const json = stored.encrypted
      ? safeStorage.decryptString(Buffer.from(stored.payload, 'base64'))
      : Buffer.from(stored.payload, 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    const normalized = normalizeCredential(parsed)
    if (!normalized) return null
    cached = normalized
    if (stored.version !== 2 || !stored.encrypted) {
      await saveCredential(normalized)
    }
    loaded = true
    return cached
  } catch {
    // 解密失败（常见于密钥环尚未解锁）：不缓存失败结果、保留文件，下次调用重试。
    return null
  }
}

export async function saveCredential(credential: Credential): Promise<void> {
  const normalized = normalizeCredential(credential)
  if (!normalized) {
    throw new Error('拒绝保存无效凭证')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统密钥环不可用，拒绝以明文保存凭证')
  }
  cached = normalized
  const json = JSON.stringify(normalized)
  const stored: StoredCredential = {
    version: 2,
    encrypted: true,
    payload: safeStorage.encryptString(json).toString('base64')
  }
  await mkdir(dirname(credentialFile()), { recursive: true })
  await writeFile(credentialFile(), JSON.stringify(stored), { mode: 0o600 })
}

export async function clearCredential(): Promise<void> {
  cached = null
  loaded = true
  await rm(credentialFile(), { force: true })
}
