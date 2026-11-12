import { app } from 'electron'
import { copyFile, mkdir, readdir, rm, stat, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Quality } from '../../shared/types'
import { AUDIO_CACHE_DIR } from '../../shared/constants'
import { getSettings } from '../settings'
import { getCredential } from '../credential'

function cacheRoot(): string {
  return join(app.getPath('userData'), 'cache', AUDIO_CACHE_DIR)
}

function scope(): string {
  return getCredential()?.musicid ?? 'anonymous'
}

function extension(quality: Quality): string {
  return quality === 'flac' ? 'flac' : 'mp3'
}

function qualityDir(quality: Quality): string {
  return join(cacheRoot(), scope(), quality)
}

function filePath(songMid: string, quality: Quality): string {
  return join(qualityDir(quality), `${songMid}.${extension(quality)}`)
}

/** 返回缓存文件路径；未命中返回 null。 */
export function getCachedAudio(songMid: string, quality: Quality): string | null {
  const path = filePath(songMid, quality)
  return existsSync(path) ? path : null
}

/** 返回该歌曲已有的最高缓存档位；无缓存返回 null。 */
export function getCachedAudioInfo(songMid: string): Quality | null {
  for (const quality of ['flac', '320k', '128k'] as Quality[]) {
    if (existsSync(filePath(songMid, quality))) return quality
  }
  return null
}

/** 把缓存文件复制到下载文件；返回实际使用的源文件。 */
export async function copyCachedAudio(
  songMid: string,
  quality: Quality,
  targetPath: string
): Promise<string | null> {
  const source = getCachedAudio(songMid, quality)
  if (!source) return null
  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(source, targetPath)
  return source
}

async function totalBytes(): Promise<number> {
  let bytes = 0
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else {
        try {
          bytes += (await stat(path)).size
        } catch {
          // 文件已删除。
        }
      }
    }
  }
  await walk(cacheRoot())
  return bytes
}

async function enforceLimit(): Promise<void> {
  const limit = getSettings().audioCacheMaxBytes
  let bytes = await totalBytes()
  if (bytes <= limit) return
  const files: Array<{ path: string; size: number; mtimeMs: number }> = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else {
        try {
          const info = await stat(path)
          files.push({ path, size: info.size, mtimeMs: info.mtimeMs })
        } catch {
          // 忽略已消失的文件。
        }
      }
    }
  }
  await walk(cacheRoot())
  files.sort((a, b) => a.mtimeMs - b.mtimeMs)
  for (const file of files) {
    if (bytes <= limit) break
    await rm(file.path, { force: true })
    bytes -= file.size
  }
}

/** 按当前设置的上限清理缓存；设置页下调上限后立即生效。 */
export async function enforceAudioCacheLimit(): Promise<void> {
  await enforceLimit()
}

/** 将已下载的音频体写入缓存，并按 LRU 清理。 */
export async function putCachedAudio(
  songMid: string,
  quality: Quality,
  sourcePath: string
): Promise<void> {
  const target = filePath(songMid, quality)
  await mkdir(qualityDir(quality), { recursive: true })
  await copyFile(sourcePath, target)
  await unlink(sourcePath).catch(() => undefined)
  await enforceLimit()
}

export async function clearAudioCache(): Promise<void> {
  await rm(cacheRoot(), { recursive: true, force: true })
}

export async function audioCacheStats(): Promise<{ bytes: number; files: number }> {
  let files = 0
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else {
        files += 1
      }
    }
  }
  await walk(cacheRoot())
  return { bytes: await totalBytes(), files }
}

export { cacheRoot as audioCacheRoot }
