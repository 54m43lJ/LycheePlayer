import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DownloadStorageInfo, DownloadTask, Quality } from '../../shared/types'
import { getSettings } from '../settings'
import { getDetail, resolveStreamUrls } from '../api/song'

interface RuntimeTask {
  task: DownloadTask
  controller: AbortController | null
}

const tasks = new Map<string, RuntimeTask>()

function downloadDir(): string {
  return getSettings().downloadDir || join(app.getPath('music'), 'Lychee Player')
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'audio'
}

function extension(quality: Quality): string {
  return quality === 'flac' ? 'flac' : 'mp3'
}

function snapshot(task: DownloadTask): DownloadTask {
  return { ...task }
}

export async function listDownloads(): Promise<DownloadTask[]> {
  return [...tasks.values()].map((item) => snapshot(item.task))
}

async function downloadCover(url: string, basePath: string): Promise<string | null> {
  if (!url) return null
  const target = `${basePath}.jpg`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    await writeFile(target, Buffer.from(await response.arrayBuffer()))
    return target
  } catch {
    return null
  }
}

async function runDownload(runtime: RuntimeTask, url: string): Promise<void> {
  const { task } = runtime
  const partPath = `${task.filePath}.part`
  const existing = await stat(partPath).then((info) => info.size).catch(() => 0)
  runtime.controller = new AbortController()
  task.status = 'downloading'
  task.error = ''

  try {
    const headers: Record<string, string> = {}
    if (existing > 0) headers.Range = `bytes=${existing}-`
    const response = await fetch(url, { headers, signal: runtime.controller.signal })
    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status}`)
    }
    const length = Number(response.headers.get('content-length') ?? 0)
    task.totalBytes = response.status === 206 ? existing + length : length
    task.receivedBytes = response.status === 206 ? existing : 0

    await mkdir(dirname(task.filePath), { recursive: true })
    const file = createWriteStream(partPath, { flags: response.status === 206 ? 'a' : 'w' })
    const body = response.body
    if (!body) throw new Error('响应没有音频体')
    const reader = body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        task.receivedBytes += value.byteLength
        await new Promise<void>((resolve, reject) => {
          file.write(Buffer.from(value), (error) => (error ? reject(error) : resolve()))
        })
      }
    } finally {
      await new Promise<void>((resolve) => file.end(resolve))
    }

    if (runtime.controller.signal.aborted) {
      task.status = 'paused'
      return
    }
    await rename(partPath, task.filePath)
    task.status = 'done'
    task.receivedBytes = task.totalBytes || task.receivedBytes
    task.coverPath = await downloadCover(
      task.coverPath ?? '',
      task.filePath.slice(0, -extname(task.filePath).length)
    )
  } catch (error) {
    if (runtime.controller?.signal.aborted) {
      task.status = 'paused'
      return
    }
    task.status = 'failed'
    task.error = error instanceof Error ? error.message : String(error)
  } finally {
    runtime.controller = null
  }
}

export async function startDownload(songMid: string, quality: Quality): Promise<DownloadTask> {
  const existing = [...tasks.values()].find(
    (item) => item.task.songMid === songMid && item.task.status !== 'done'
  )
  if (existing) return snapshot(existing.task)

  const songs = await getDetail([songMid])
  const song = songs[0]
  if (!song) throw new Error('歌曲不存在')
  const resolved = await resolveStreamUrls([songMid], quality)
  const resolvedUrl = resolved.get(songMid)
  if (!resolvedUrl) throw new Error('当前账号无权下载该歌曲')

  const singer = song.singers.map((item) => item.name).join(' / ')
  const base = safeName(singer ? `${singer} - ${song.name}` : song.name)
  const filePath = join(downloadDir(), `${base}.${extension(resolvedUrl.quality)}`)
  const task: DownloadTask = {
    id: randomUUID(),
    songMid,
    name: song.name,
    quality: resolvedUrl.quality,
    filePath,
    coverPath: song.album.mid
      ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${song.album.mid}.jpg`
      : null,
    status: 'pending',
    receivedBytes: 0,
    totalBytes: 0,
    error: ''
  }
  const runtime: RuntimeTask = { task, controller: null }
  tasks.set(task.id, runtime)
  void runDownload(runtime, resolvedUrl.url)
  return snapshot(task)
}

export async function pauseDownload(id: string): Promise<DownloadTask> {
  const runtime = tasks.get(id)
  if (!runtime) throw new Error('下载任务不存在')
  if (runtime.task.status === 'downloading') runtime.controller?.abort()
  runtime.task.status = 'paused'
  return snapshot(runtime.task)
}

export async function resumeDownload(id: string): Promise<DownloadTask> {
  const runtime = tasks.get(id)
  if (!runtime) throw new Error('下载任务不存在')
  if (runtime.task.status === 'downloading' || runtime.task.status === 'done') {
    return snapshot(runtime.task)
  }
  const resolved = await resolveStreamUrls([runtime.task.songMid], runtime.task.quality)
  const url = resolved.get(runtime.task.songMid)?.url
  if (!url) {
    runtime.task.status = 'failed'
    runtime.task.error = '没有可用的下载链接'
    return snapshot(runtime.task)
  }
  void runDownload(runtime, url)
  return snapshot(runtime.task)
}

export async function removeDownload(id: string): Promise<void> {
  const runtime = tasks.get(id)
  if (!runtime) return
  runtime.controller?.abort()
  tasks.delete(id)
  await rm(runtime.task.filePath, { force: true })
  await rm(`${runtime.task.filePath}.part`, { force: true })
}

export async function clearCompletedDownloads(): Promise<void> {
  for (const [id, runtime] of tasks) {
    if (runtime.task.status === 'done') tasks.delete(id)
  }
}

/** 文档签名保留：把远程 URL 写入给定文件（不经过任务表）。 */
export async function writePart(url: string, filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()))
}

async function directoryBytes(dir: string): Promise<number> {
  let bytes = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    try {
      bytes += entry.isDirectory() ? await directoryBytes(path) : (await stat(path)).size
    } catch {
      // 忽略已消失的文件。
    }
  }
  return bytes
}

export async function downloadStorage(): Promise<DownloadStorageInfo> {
  const directory = downloadDir()
  const bytes = await directoryBytes(directory)
  let freeBytes = 0
  try {
    const fs = await statfs(directory)
    freeBytes = Number(fs.bavail) * Number(fs.bsize)
  } catch {
    try {
      const fs = await statfs(dirname(directory))
      freeBytes = Number(fs.bavail) * Number(fs.bsize)
    } catch {
      // 目录尚未创建时剩余空间为 0。
    }
  }
  return { directory, bytes, freeBytes }
}
