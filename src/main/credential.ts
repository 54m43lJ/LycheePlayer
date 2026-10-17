import { app, safeStorage } from 'electron'
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Credential } from '../shared/types'

interface StoredCredential {
  version: 1
  encrypted: boolean
  payload: string
}

let cached: Credential | null = null
let loaded = false

function credentialFile(): string {
  return join(app.getPath('userData'), 'credential.bin')
}

function isValidCredential(value: unknown): value is Credential {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
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

export async function loadCredential(): Promise<Credential | null> {
  if (loaded) return cached
  loaded = true
  try {
    const raw = await readFile(credentialFile(), 'utf8')
    const stored = JSON.parse(raw) as StoredCredential
    if (stored.version !== 1 || typeof stored.payload !== 'string') return null

    const json = stored.encrypted
      ? safeStorage.decryptString(Buffer.from(stored.payload, 'base64'))
      : Buffer.from(stored.payload, 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (!isValidCredential(parsed)) return null
    cached = parsed
    return cached
  } catch {
    return null
  }
}

export async function saveCredential(credential: Credential): Promise<void> {
  if (!isValidCredential(credential)) {
    throw new Error('拒绝保存无效凭证')
  }
  cached = credential
  const json = JSON.stringify(credential)
  const canEncrypt = safeStorage.isEncryptionAvailable()
  const stored: StoredCredential = {
    version: 1,
    encrypted: canEncrypt,
    payload: canEncrypt
      ? safeStorage.encryptString(json).toString('base64')
      : Buffer.from(json, 'utf8').toString('base64')
  }
  await mkdir(dirname(credentialFile()), { recursive: true })
  await writeFile(credentialFile(), JSON.stringify(stored), { mode: 0o600 })
}

export async function clearCredential(): Promise<void> {
  cached = null
  loaded = true
  await rm(credentialFile(), { force: true })
}
