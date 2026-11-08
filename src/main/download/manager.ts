import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  DownloadBatch,
  DownloadSource,
  DownloadStorageInfo,
  DownloadTask,
  Quality,
  SongAssetState
} from '../../shared/types'
import {
  DOWNLOAD_BATCH_MAX,
  DOWNLOAD_INDEX_PREFIX,
  DOWNLOAD_INDEX_SAVE_MS
} from '../../shared/constants'
import { getCredential } from '../credential'
import { getSettings } from '../settings'
import { getDetail, resolveStreamUrls } from '../api/song'
import { peekAvailability } from '../api/availability'
import { getCachedAudio, getCachedAudioInfo, linkCachedAudio } from '../cache/audio'

interface RuntimeTask {
  task: DownloadTask
  controller: AbortController | null
}

interface DownloadIndex {
  tasks: DownloadTask[]
  batches: DownloadBatch[]
}

const tasks = new Map<string, RuntimeTask>()
const batches = new Map<string, DownloadBatch>()

let loadedScope = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let running = false
let pumpScheduled = false

function scope(): string {
  return getCredential()?.musicid ?? 'anonymous'
}

function downloadDir(): string {
  return getSettings().downloadDir || join(app.getPath('music'), 'Lychee Player')
}

function indexPath(): string {
  return join(downloadDir(), `${DOWNLOAD_INDEX_PREFIX}${scope()}.json`)
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

function batchSnapshot(batch: DownloadBatch): DownloadBatch {
  return { ...batch }
}

function persistable(task: DownloadTask): DownloadTask {
  if (task.status === 'downloading' || task.status === 'pending') {
    return { ...task, status: 'paused' }
  }
  return { ...task }
}

function scheduleSave(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveIndex()
  }, DOWNLOAD_INDEX_SAVE_MS)
}

export async function flushDownloads(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await saveIndex()
}

async function saveIndex(): Promise<void> {
  const directory = downloadDir()
  try {
    await mkdir(directory, { recursive: true })
    const index: DownloadIndex = {
      tasks: [...tasks.values()]
        .map((item) => persistable(item.task))
        .filter((task) => task.status === 'done' || task.status === 'paused'),
      batches: [...batches.values()]
    }
    const file = indexPath()
    await writeFile(`${file}.part`, JSON.stringify(index, null, 2), { mode: 0o600 })
    await rename(`${file}.part`, file)
  } catch {
    // 索引写入失败不阻塞下载。
  }
}

async function loadIndex(): Promise<void> {
  tasks.clear()
  batches.clear()
  try {
    const raw = JSON.parse(await readFile(indexPath(), 'utf8')) as Partial<DownloadIndex>
    for (const task of raw.tasks ?? []) {
      if (!task || typeof task !== 'object') continue
      const normalized: DownloadTask = {
        ...task,
        source: (task.source as DownloadSource) ?? 'network',
        batchId: task.batchId ?? null,
        playlistId: task.playlistId ?? null
      }
      if (normalized.status === 'done' && !existsSync(normalized.filePath)) continue
      if (normalized.status === 'downloading' || normalized.status === 'pending') {
        normalized.status = 'paused'
      }
      tasks.set(normalized.id, { task: normalized, controller: null })
    }
    for (const batch of raw.batches ?? []) {
      if (!batch || typeof batch !== 'object') continue
      const normalized: DownloadBatch = { ...batch }
      if (normalized.status === 'downloading' || normalized.status === 'pending') {
        normalized.status = 'paused'
      }
      batches.set(normalized.id, normalized)
    }
    for (const batch of batches.values()) recalcBatch(batch)
  } catch {
    // 无索引或索引损坏时以空列表启动。
  }
}

/** 切换账号时切换索引视图；不移动磁盘文件。 */
async function ensureScope(): Promise<void> {
  const current = scope()
  if (loadedScope === current) return
  for (const runtime of tasks.values()) runtime.controller?.abort()
  loadedScope = current
  await loadIndex()
}

function recalcBatch(batch: DownloadBatch): void {
  const items = [...tasks.values()]
    .map((item) => item.task)
    .filter((task) => task.batchId === batch.id)
  batch.total = items.length
  batch.done = items.filter((task) => task.status === 'done').length
  batch.failed = items.filter((task) => task.status === 'failed').length
  const active = items.some(
    (task) => task.status === 'downloading' || task.status === 'pending'
  )
  if (items.length === 0) {
    batch.status = 'done'
  } else if (active) {
    batch.status = batch.status === 'paused' ? 'paused' : 'downloading'
  } else if (batch.failed > 0) {
    batch.status = 'failed'
  } else {
    batch.status = 'done'
  }
  scheduleSave()
}

function touchTask(task: DownloadTask): void {
  if (task.batchId) {
    const batch = batches.get(task.batchId)
    if (batch) recalcBatch(batch)
  }
  scheduleSave()
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

async function resolveDownload(
  songMid: string,
  requested: Quality
): Promise<{ url: string; quality: Quality; name: string; albumMid: string }> {
  const songs = await getDetail([songMid])
  const song = songs[0]
  if (!song) throw new Error('歌曲不存在')
  const resolved = await resolveStreamUrls([songMid], requested)
  const item = resolved.get(songMid)
  if (!item?.url) throw new Error('当前账号无权下载该歌曲')
  return { url: item.url, quality: item.quality, name: song.name, albumMid: song.album.mid }
}

async function runDownload(runtime: RuntimeTask, url: string): Promise<void> {
  const { task } = runtime
  const partPath = `${task.filePath}.part`
  const existing = await stat(partPath).then((info) => info.size).catch(() => 0)
  runtime.controller = new AbortController()
  task.status = 'downloading'
  task.error = ''
  touchTask(task)

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
      touchTask(task)
      return
    }
    await rename(partPath, task.filePath)
    task.status = 'done'
    task.receivedBytes = task.totalBytes || task.receivedBytes
    const coverBase = task.filePath.slice(0, -extname(task.filePath).length)
    task.coverPath = await downloadCover(task.coverPath ?? '', coverBase)
    touchTask(task)
  } catch (error) {
    if (runtime.controller?.signal.aborted) {
      task.status = 'paused'
      touchTask(task)
      return
    }
    task.status = 'failed'
    task.error = error instanceof Error ? error.message : String(error)
    touchTask(task)
  } finally {
    runtime.controller = null
  }
}

/** 串行执行待下载任务；并发固定为 1。 */
async function pump(): Promise<void> {
  if (running) return
  running = true
  try {
    for (;;) {
      const next = [...tasks.values()].find((item) => item.task.status === 'pending')
      if (!next) break
      const { task } = next
      try {
        const resolved = await resolveDownload(task.songMid, task.quality)
        task.quality = resolved.quality
        task.name = resolved.name
        const base = safeName(task.name)
        task.filePath = join(downloadDir(), `${base}.${extension(resolved.quality)}`)
        task.coverPath = resolved.albumMid
          ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${resolved.albumMid}.jpg`
          : null
        const cached = getCachedAudio(task.songMid, resolved.quality)
        if (cached) {
          try {
            await mkdir(dirname(task.filePath), { recursive: true })
            await linkCachedAudio(task.songMid, resolved.quality, task.filePath)
            task.source = 'cache'
            task.status = 'done'
            task.receivedBytes = await stat(task.filePath)
              .then((info) => info.size)
              .catch(() => task.receivedBytes)
            task.totalBytes = task.receivedBytes
            touchTask(task)
            continue
          } catch {
            // 本地转移失败时回退为正常网络下载。
            task.source = 'network'
          }
        }
        await runDownload(next, resolved.url)
      } catch (error) {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : String(error)
        touchTask(task)
      }
    }
  } finally {
    running = false
  }
}

function schedulePump(): void {
  if (pumpScheduled) return
  pumpScheduled = true
  setTimeout(() => {
    pumpScheduled = false
    void pump()
  }, 0)
}

export async function listDownloads(): Promise<DownloadTask[]> {
  await ensureScope()
  return [...tasks.values()].map((item) => snapshot(item.task))
}

export async function listBatches(): Promise<DownloadBatch[]> {
  await ensureScope()
  return [...batches.values()]
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map(batchSnapshot)
}

export async function assetStates(songMids: string[]): Promise<SongAssetState[]> {
  await ensureScope()
  const unique = [...new Set(songMids.filter(Boolean))]
  // 只读可用性缓存：列表探测已经填充；这里不再为上架状态额外打上游。
  const maxQualities = peekAvailability(unique)
  return unique.map((songMid) => {
    const done = [...tasks.values()]
      .map((item) => item.task)
      .filter((task) => task.songMid === songMid && task.status === 'done')
      .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))[0]
    const active = [...tasks.values()]
      .map((item) => item.task)
      .find(
        (task) =>
          task.songMid === songMid &&
          (task.status === 'downloading' ||
            task.status === 'pending' ||
            task.status === 'paused' ||
            task.status === 'failed')
      )
    return {
      songMid,
      cachedQuality: getCachedAudioInfo(songMid),
      downloadedQuality: done?.quality ?? null,
      maxQuality: maxQualities.get(songMid)?.maxQuality ?? null,
      taskStatus: active?.status ?? null
    }
  })
}

function qualityRank(quality: Quality): number {
  if (quality === 'flac') return 3
  if (quality === '320k') return 2
  return 1
}

export async function startDownload(songMid: string, _quality: Quality): Promise<DownloadTask> {
  await ensureScope()
  const existing = [...tasks.values()].find(
    (item) => item.task.songMid === songMid && item.task.status !== 'failed'
  )
  if (existing) return snapshot(existing.task)

  const task: DownloadTask = {
    id: randomUUID(),
    songMid,
    name: songMid,
    // 下载统一按最高可用档解析；实际档位在任务执行时回填。
    quality: 'flac',
    filePath: join(downloadDir(), `${safeName(songMid)}.mp3`),
    coverPath: null,
    status: 'pending',
    receivedBytes: 0,
    totalBytes: 0,
    error: '',
    batchId: null,
    playlistId: null,
    source: 'network'
  }
  tasks.set(task.id, { task, controller: null })
  schedulePump()
  return snapshot(task)
}

export async function startBatch(request: {
  source: 'playlist'
  playlistId: string
  playlistName?: string
  songMids: string[]
}): Promise<DownloadBatch> {
  await ensureScope()
  const mids = [...new Set(request.songMids.filter(Boolean))].slice(0, DOWNLOAD_BATCH_MAX)
  const songs = await getDetail(mids)
  const nameByMid = new Map(songs.map((song) => [song.songMid, song.name]))
  const batch: DownloadBatch = {
    id: randomUUID(),
    source: 'playlist',
    playlistId: request.playlistId,
    playlistName: request.playlistName ?? null,
    total: mids.length,
    done: 0,
    failed: 0,
    status: mids.length > 0 ? 'pending' : 'done',
    createdAtMs: Date.now()
  }
  batches.set(batch.id, batch)
  for (const mid of mids) {
    const existing = [...tasks.values()].find(
      (item) => item.task.songMid === mid && item.task.status !== 'failed'
    )
    if (existing) {
      existing.task.batchId = batch.id
      existing.task.playlistId = request.playlistId
      continue
    }
    const task: DownloadTask = {
      id: randomUUID(),
      songMid: mid,
      name: nameByMid.get(mid) ?? mid,
      quality: 'flac',
      filePath: join(downloadDir(), `${safeName(nameByMid.get(mid) ?? mid)}.mp3`),
      coverPath: null,
      status: 'pending',
      receivedBytes: 0,
      totalBytes: 0,
      error: '',
      batchId: batch.id,
      playlistId: request.playlistId,
      source: 'batch'
    }
    tasks.set(task.id, { task, controller: null })
  }
  recalcBatch(batch)
  schedulePump()
  return batchSnapshot(batch)
}

export async function pauseDownload(id: string): Promise<DownloadTask> {
  await ensureScope()
  const runtime = tasks.get(id)
  if (!runtime) throw new Error('下载任务不存在')
  if (runtime.task.status === 'downloading') runtime.controller?.abort()
  runtime.task.status = 'paused'
  touchTask(runtime.task)
  return snapshot(runtime.task)
}

export async function resumeDownload(id: string): Promise<DownloadTask> {
  await ensureScope()
  const runtime = tasks.get(id)
  if (!runtime) throw new Error('下载任务不存在')
  if (runtime.task.status === 'downloading' || runtime.task.status === 'done') {
    return snapshot(runtime.task)
  }
  runtime.task.status = 'pending'
  runtime.task.error = ''
  if (runtime.task.batchId) {
    const batch = batches.get(runtime.task.batchId)
    if (batch) batch.status = 'downloading'
  }
  touchTask(runtime.task)
  schedulePump()
  return snapshot(runtime.task)
}

export async function removeDownload(id: string): Promise<void> {
  await ensureScope()
  const runtime = tasks.get(id)
  if (!runtime) return
  runtime.controller?.abort()
  tasks.delete(id)
  await rm(runtime.task.filePath, { force: true })
  await rm(`${runtime.task.filePath}.part`, { force: true })
  if (runtime.task.batchId) {
    const batch = batches.get(runtime.task.batchId)
    if (batch) recalcBatch(batch)
  }
  scheduleSave()
}

export async function pauseBatch(batchId: string): Promise<DownloadBatch> {
  await ensureScope()
  const batch = batches.get(batchId)
  if (!batch) throw new Error('下载批次不存在')
  batch.status = 'paused'
  for (const runtime of tasks.values()) {
    if (runtime.task.batchId !== batchId) continue
    if (runtime.task.status === 'downloading') runtime.controller?.abort()
    if (runtime.task.status === 'downloading' || runtime.task.status === 'pending') {
      runtime.task.status = 'paused'
    }
  }
  recalcBatch(batch)
  return batchSnapshot(batch)
}

export async function resumeBatch(batchId: string): Promise<DownloadBatch> {
  await ensureScope()
  const batch = batches.get(batchId)
  if (!batch) throw new Error('下载批次不存在')
  for (const runtime of tasks.values()) {
    if (runtime.task.batchId !== batchId) continue
    if (runtime.task.status === 'paused') {
      runtime.task.status = 'pending'
      runtime.task.error = ''
    }
  }
  batch.status = 'downloading'
  recalcBatch(batch)
  schedulePump()
  return batchSnapshot(batch)
}

export async function removeBatch(batchId: string): Promise<void> {
  await ensureScope()
  const batch = batches.get(batchId)
  if (!batch) return
  for (const [id, runtime] of [...tasks]) {
    if (runtime.task.batchId !== batchId) continue
    runtime.controller?.abort()
    tasks.delete(id)
    await rm(runtime.task.filePath, { force: true })
    await rm(`${runtime.task.filePath}.part`, { force: true })
  }
  batches.delete(batchId)
  scheduleSave()
}

export async function retryFailed(batchId: string): Promise<DownloadBatch> {
  await ensureScope()
  const batch = batches.get(batchId)
  if (!batch) throw new Error('下载批次不存在')
  for (const runtime of tasks.values()) {
    if (runtime.task.batchId !== batchId) continue
    if (runtime.task.status === 'failed') {
      runtime.task.status = 'pending'
      runtime.task.error = ''
    }
  }
  batch.status = 'downloading'
  recalcBatch(batch)
  schedulePump()
  return batchSnapshot(batch)
}

export async function clearCompletedDownloads(): Promise<void> {
  await ensureScope()
  // 只清记录，不删除磁盘文件。
  for (const [id, runtime] of tasks) {
    if (runtime.task.status === 'done') tasks.delete(id)
  }
  for (const batch of batches.values()) recalcBatch(batch)
  scheduleSave()
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
    if (entry.name.startsWith(DOWNLOAD_INDEX_PREFIX)) continue
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
  await ensureScope()
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
  return {
    directory,
    bytes,
    freeBytes,
    batchCount: batches.size
  }
}
