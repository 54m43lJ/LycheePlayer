import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, parse, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  DownloadSource,
  DownloadStorageInfo,
  DownloadTask,
  Quality,
  SongAssetState
} from '../../shared/types'
import {
  DOWNLOAD_INDEX_PREFIX,
  DOWNLOAD_INDEX_SAVE_MS,
  DOWNLOAD_QUEUE_MAX
} from '../../shared/constants'
import { getCredential } from '../credential'
import { getSettings } from '../settings'
import { UpstreamError, upstreamBlockRemainingMs } from '../api/client'
import { getDetail, resolveStreamUrls } from '../api/song'
import { peekAvailability } from '../api/availability'
import { getCachedAudio, getCachedAudioInfo, copyCachedAudio } from '../cache/audio'
import { setDownloadedAudioResolver } from './registry'

interface RuntimeTask {
  task: DownloadTask
  controller: AbortController | null
}

interface DownloadIndex {
  tasks: DownloadTask[]
}

const tasks = new Map<string, RuntimeTask>()

let loadedScope = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let running = false
let pumpScheduled = false
let blockTimer: ReturnType<typeof setTimeout> | null = null

function scope(): string {
  return getCredential()?.musicid ?? 'anonymous'
}

function downloadDir(): string {
  return getSettings().downloadDir || join(app.getPath('music'), 'Lychee Player')
}

function indexPath(): string {
  return join(downloadDir(), `${DOWNLOAD_INDEX_PREFIX}${scope()}.json`)
}

function cleanName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()
}

function safeName(value: string): string {
  return cleanName(value) || 'audio'
}

/**
 * 下载文件名固定为“歌名-歌手-专辑”，避免不同歌手 / 专辑的同名歌曲互相覆盖。
 * 缺失的片段直接跳过；多个歌手用顿号连接后再统一清洗非法字符。
 */
export function downloadFileName(name: string, singers: string[], albumName: string): string {
  return (
    [name, singers.join('、'), albumName]
      .map((part) => cleanName(part))
      .filter(Boolean)
      .join('-') || 'audio'
  )
}

function extension(quality: Quality): string {
  return quality === 'flac' ? 'flac' : 'mp3'
}

function snapshot(task: DownloadTask): DownloadTask {
  return { ...task }
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

function indexSnapshot(): DownloadIndex {
  return {
    tasks: [...tasks.values()]
      .map((item) => persistable(item.task))
      .filter((task) => task.status === 'done' || task.status === 'paused')
  }
}

/** 退出前同步落盘，避免异步写入被进程退出截断。 */
export function flushDownloads(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  // 从未访问过下载模块时不要用空快照覆盖已有索引。
  if (!loadedScope) return
  try {
    const directory = downloadDir()
    mkdirSync(directory, { recursive: true })
    const file = indexPath()
    writeFileSync(`${file}.part`, JSON.stringify(indexSnapshot(), null, 2), { mode: 0o600 })
    renameSync(`${file}.part`, file)
  } catch {
    // 退出阶段写入失败不再阻塞。
  }
}

async function saveIndex(): Promise<void> {
  if (!loadedScope) return
  const directory = downloadDir()
  try {
    await mkdir(directory, { recursive: true })
    const index = indexSnapshot()
    const file = indexPath()
    await writeFile(`${file}.part`, JSON.stringify(index, null, 2), { mode: 0o600 })
    await rename(`${file}.part`, file)
  } catch {
    // 索引写入失败不阻塞下载。
  }
}

async function loadIndex(): Promise<void> {
  tasks.clear()
  try {
    const raw = JSON.parse(await readFile(indexPath(), 'utf8')) as Partial<DownloadIndex>
    for (const task of raw.tasks ?? []) {
      if (!task || typeof task !== 'object') continue
      const normalized: DownloadTask = {
        ...task,
        source: task.source === 'cache' ? 'cache' : 'network'
      }
      if (normalized.status === 'done' && !existsSync(normalized.filePath)) continue
      if (normalized.status === 'downloading' || normalized.status === 'pending') {
        normalized.status = 'paused'
      }
      tasks.set(normalized.id, { task: normalized, controller: null })
    }
  } catch {
    // 无索引或索引损坏时以空列表启动。
  }
}

/** 切换账号时切换索引视图；不移动磁盘文件。 */
async function ensureScope(): Promise<void> {
  const current = scope()
  if (loadedScope === current) return
  if (loadedScope) {
    // 先把旧账号的索引落盘，再切换视图。
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await saveIndex()
  }
  for (const runtime of tasks.values()) runtime.controller?.abort()
  loadedScope = current
  await loadIndex()
}

function touchTask(_task: DownloadTask): void {
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
): Promise<{
  url: string
  quality: Quality
  name: string
  singers: string[]
  albumName: string
  albumMid: string
}> {
  const songs = await getDetail([songMid])
  const song = songs[0]
  if (!song) throw new Error('歌曲不存在')
  const resolved = await resolveStreamUrls([songMid], requested)
  const item = resolved.get(songMid)
  if (!item?.url) throw new Error('当前账号无权下载该歌曲')
  return {
    url: item.url,
    quality: item.quality,
    name: song.name,
    singers: song.singers.map((singer) => singer.name).filter(Boolean),
    albumName: song.album.name,
    albumMid: song.album.mid
  }
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
      // 上游处于 104009 截断窗口时不继续出队，等窗口结束后自动恢复。
      if (upstreamBlockRemainingMs() > 0) {
        schedulePumpAfterBlock()
        break
      }
      const next = [...tasks.values()].find((item) => item.task.status === 'pending')
      if (!next) break
      const { task } = next
      try {
        const resolved = await resolveDownload(task.songMid, task.quality)
        task.quality = resolved.quality
        task.name = resolved.name
        const base = downloadFileName(resolved.name, resolved.singers, resolved.albumName)
        task.filePath = join(downloadDir(), `${base}.${extension(resolved.quality)}`)
        task.coverPath = resolved.albumMid
          ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${resolved.albumMid}.jpg`
          : null
        const cached = getCachedAudio(task.songMid, resolved.quality)
        if (cached) {
          try {
            await mkdir(dirname(task.filePath), { recursive: true })
            await copyCachedAudio(task.songMid, resolved.quality, task.filePath)
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
        if (error instanceof UpstreamError && error.upstreamCode === 104009) {
          // 风控截断不是任务本身失败：保留待下载状态，窗口结束后继续。
          task.status = 'pending'
          task.error = ''
          touchTask(task)
          schedulePumpAfterBlock()
          break
        }
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : String(error)
        touchTask(task)
      }
    }
  } finally {
    running = false
  }
}

function schedulePumpAfterBlock(): void {
  if (blockTimer) return
  const delay = Math.max(1000, upstreamBlockRemainingMs() + 1000)
  blockTimer = setTimeout(() => {
    blockTimer = null
    schedulePump()
  }, delay)
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

/** 查找本机已下载的音频文件；优先请求档位，否则取最高已下载档。 */
export async function findDownloadedAudio(
  songMid: string,
  quality: Quality
): Promise<{ filePath: string; quality: Quality } | null> {
  await ensureScope()
  const done = [...tasks.values()]
    .map((item) => item.task)
    .filter(
      (task) =>
        task.songMid === songMid && task.status === 'done' && existsSync(task.filePath)
    )
  if (done.length === 0) return null
  const exact = done.find((task) => task.quality === quality)
  const best = exact ?? done.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))[0]
  return { filePath: best.filePath, quality: best.quality }
}

setDownloadedAudioResolver(findDownloadedAudio)

interface EnqueueOptions {
  source?: DownloadSource
}

/**
 * 只把歌曲 mid 放入统一队列；歌曲名、文件路径、可用音质等都在 pump 出队时再解析。
 * 单曲下载与“下载全部”共用此入口。
 */
function enqueueTask(songMid: string, options: EnqueueOptions = {}): DownloadTask {
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
    source: options.source ?? 'network'
  }
  tasks.set(task.id, { task, controller: null })
  return task
}

function enqueueMissing(songMid: string): DownloadTask {
  const existing = [...tasks.values()].find(
    (item) => item.task.songMid === songMid && item.task.status !== 'failed'
  )
  return existing ? existing.task : enqueueTask(songMid)
}

export async function startDownload(songMid: string, _quality: Quality): Promise<DownloadTask> {
  const [task] = await startDownloads([songMid], _quality)
  return task
}

/** 把多首歌曲按给定顺序加入同一队列；已存在同曲任务时复用，不合并成批次。 */
export async function startDownloads(
  songMids: string[],
  _quality: Quality
): Promise<DownloadTask[]> {
  await ensureScope()
  const mids = [...new Set(songMids.filter(Boolean))].slice(0, DOWNLOAD_QUEUE_MAX)
  const result = mids.map((mid) => snapshot(enqueueMissing(mid)))
  schedulePump()
  return result
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
  touchTask(runtime.task)
  schedulePump()
  return snapshot(runtime.task)
}

/** 继续所有已暂停任务；返回被重置为 pending 的任务快照。 */
export async function resumeAllDownloads(): Promise<DownloadTask[]> {
  await ensureScope()
  const resumed: DownloadTask[] = []
  for (const runtime of tasks.values()) {
    if (runtime.task.status !== 'paused') continue
    runtime.task.status = 'pending'
    runtime.task.error = ''
    touchTask(runtime.task)
    resumed.push(snapshot(runtime.task))
  }
  if (resumed.length > 0) schedulePump()
  return resumed
}

export async function removeDownload(id: string): Promise<void> {
  await ensureScope()
  const runtime = tasks.get(id)
  if (!runtime) return
  runtime.controller?.abort()
  tasks.delete(id)
  await rm(runtime.task.filePath, { force: true })
  await rm(`${runtime.task.filePath}.part`, { force: true })
  scheduleSave()
}

export async function clearCompletedDownloads(): Promise<void> {
  await ensureScope()
  // 只清记录，不删除磁盘文件。
  for (const [id, runtime] of tasks) {
    if (runtime.task.status === 'done') tasks.delete(id)
  }
  scheduleSave()
}

async function stopRuntime(runtime: RuntimeTask): Promise<void> {
  const controller = runtime.controller
  if (!controller) return
  controller.abort()
  // 等待文件流与 fetch 收尾，避免清空目录后又被正在退出的任务写回。
  const deadline = Date.now() + 2000
  while (runtime.controller && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/** 清空下载目录：停止任务后删除目录内全部内容，并清空任务记录。 */
export async function clearDownloadDirectory(): Promise<void> {
  await ensureScope()
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const directory = downloadDir()
  const target = resolve(directory)
  const home = resolve(app.getPath('home'))
  if (target === parse(target).root) throw new Error('不能清空文件系统根目录')
  if (target === home || home.startsWith(`${target}${sep}`)) {
    throw new Error('不能清空用户主目录或其上级目录')
  }
  const runtimes = [...tasks.values()]
  for (const runtime of runtimes) runtime.controller?.abort()
  // 先移出队列，防止 pump 继续取下一个任务。
  tasks.clear()
  await Promise.all(runtimes.map((runtime) => stopRuntime(runtime)))
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    await rm(join(directory, entry.name), { recursive: true, force: true })
  }
  await saveIndex()
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
    freeBytes
  }
}
