import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PlaylistCacheEntry } from '../../shared/types'
import { PLAYLIST_CACHE_MAX_BYTES } from '../../shared/constants'

function cacheDir(): string {
  return join(app.getPath('userData'), 'cache', 'playlist')
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_') || 'anonymous'
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

/** 供设置页统计使用。 */
export async function playlistCacheBytes(): Promise<number> {
  return totalBytes()
}
