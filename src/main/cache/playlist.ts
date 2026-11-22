import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PlaylistCacheEntry } from '../../shared/types'
import { PLAYLIST_CACHE_MAX_BYTES } from '../../shared/constants'
import { safeCacheScope } from './scope'

function cacheDir(): string {
  return join(app.getPath('userData'), 'cache', 'playlist')
}

function safeSegment(value: string): string {
  return safeCacheScope(value)
}

function cachePath(scope: string, id: string): string {
  return join(cacheDir(), `${safeSegment(scope)}-${safeSegment(id)}.json`)
}

function isEntry(value: unknown): value is PlaylistCacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    Boolean(entry.meta) &&
    Array.isArray(entry.songs) &&
    typeof entry.total === 'number' &&
    typeof entry.complete === 'boolean' &&
    typeof entry.fetchedAtMs === 'number'
  )
}

/** 同步读取整份歌单缓存；调用方根据 fetchedAtMs 判定是否 stale。 */
export function readPlaylistCache(scope: string, id: string): PlaylistCacheEntry | null {
  try {
    const text = readFileSync(cachePath(scope, id), 'utf8')
    const parsed: unknown = JSON.parse(text)
    return isEntry(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function totalBytes(): Promise<number> {
  try {
    const files = await readdir(cacheDir())
    let bytes = 0
    for (const file of files) {
      try {
        bytes += (await stat(join(cacheDir(), file))).size
      } catch {
        // 单文件读取失败时忽略。
      }
    }
    return bytes
  } catch {
    return 0
  }
}

async function enforceLimit(): Promise<void> {
  let bytes = await totalBytes()
  if (bytes <= PLAYLIST_CACHE_MAX_BYTES) return
  try {
    const files = await readdir(cacheDir())
    const entries = await Promise.all(
      files.map(async (file) => {
        const path = join(cacheDir(), file)
        const info = await stat(path)
        return { path, size: info.size, mtimeMs: info.mtimeMs }
      })
    )
    entries.sort((a, b) => a.mtimeMs - b.mtimeMs)
    for (const entry of entries) {
      if (bytes <= PLAYLIST_CACHE_MAX_BYTES) break
      await rm(entry.path, { force: true })
      bytes -= entry.size
    }
  } catch {
    // 清理失败不阻塞写入。
  }
}

export async function writePlaylistCache(scope: string, entry: PlaylistCacheEntry): Promise<void> {
  await mkdir(cacheDir(), { recursive: true })
  await writeFile(cachePath(scope, entry.meta.id), JSON.stringify(entry), { mode: 0o600 })
  await enforceLimit()
}

export async function invalidatePlaylistCache(id: string): Promise<void> {
  const suffix = `-${safeSegment(id)}.json`
  try {
    const files = await readdir(cacheDir())
    await Promise.all(
      files
        .filter((file) => file.endsWith(suffix))
        .map((file) => rm(join(cacheDir(), file), { force: true }))
    )
  } catch {
    // 缓存目录不存在时无需处理。
  }
}

export async function clearPlaylistCache(): Promise<void> {
  try {
    await rm(cacheDir(), { recursive: true, force: true })
  } catch {
    // 目录不存在时无需处理。
  }
}

/** 按账号统计歌单缓存；文件名格式为 `<scope>-<playlistId>.json`。 */
export async function listPlaylistCacheScopes(): Promise<
  Array<{ musicid: string; bytes: number; files: number }>
> {
  const result = new Map<string, { musicid: string; bytes: number; files: number }>()
  try {
    const files = await readdir(cacheDir())
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const separator = file.indexOf('-')
      if (separator <= 0) continue
      const musicid = file.slice(0, separator)
      try {
        const info = await stat(join(cacheDir(), file))
        const item = result.get(musicid) ?? { musicid, bytes: 0, files: 0 }
        item.bytes += info.size
        item.files += 1
        result.set(musicid, item)
      } catch {
        // 文件在扫描期间被删除时忽略。
      }
    }
  } catch {
    // 缓存目录不存在时返回空列表。
  }
  return [...result.values()]
}

/** 删除指定账号的歌单缓存，不影响其他账号。 */
export async function clearPlaylistCacheForUser(scope: string): Promise<void> {
  const prefix = `${safeSegment(scope)}-`
  try {
    const files = await readdir(cacheDir())
    await Promise.all(
      files
        .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
        .map((file) => rm(join(cacheDir(), file), { force: true }))
    )
  } catch {
    // 目录不存在时无需处理。
  }
}

/** 供设置页统计使用。 */
export async function playlistCacheBytes(): Promise<number> {
  return totalBytes()
}
