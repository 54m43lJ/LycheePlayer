import { app, net, protocol } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'
import type { Quality } from '../../shared/types'
import { AUDIO_PROTOCOL_SCHEME } from '../../shared/constants'
import { getSettings } from '../settings'
import { getCachedAudio, putCachedAudio } from '../cache/audio'

interface StreamSource {
  url: string
  songMid: string
  quality: Quality
}

const streams = new Map<string, StreamSource>()

protocol.registerSchemesAsPrivileged([
  {
    scheme: AUDIO_PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function tempDir(): string {
  return join(app.getPath('userData'), 'cache', 'tmp')
}

/** 缓存文件的本地协议 URL。 */
export function audioProtocolUrl(filePath: string): string {
  return `${AUDIO_PROTOCOL_SCHEME}://file/${Buffer.from(filePath, 'utf8').toString('base64url')}`
}

/** 注册一个上游音频流并返回主进程代理 URL；渲染进程不直接访问上游。 */
export function audioStreamUrl(url: string, songMid: string, quality: Quality): string {
  const token = randomUUID()
  streams.set(token, { url, songMid, quality })
  return `${AUDIO_PROTOCOL_SCHEME}://stream/${token}`
}

async function cacheChunks(source: StreamSource, chunks: Uint8Array[]): Promise<void> {
  if (chunks.length === 0 || !getSettings().audioCacheEnabled) return
  try {
    await mkdir(tempDir(), { recursive: true })
    const temp = join(tempDir(), `${source.songMid}-${randomUUID()}`)
    await writeFile(temp, Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
    await putCachedAudio(source.songMid, source.quality, temp)
  } catch {
    // 缓存失败不影响本轮播放。
  }
}

function contentType(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.flac') return 'audio/flac'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.m4a') return 'audio/mp4'
  return 'application/octet-stream'
}

interface ByteRange {
  start: number
  end: number
}

function parseRange(header: string | null, size: number): ByteRange | null | 'invalid' {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return 'invalid'
  const startRaw = match[1]
  const endRaw = match[2]
  if (!startRaw && !endRaw) return 'invalid'
  if (!startRaw) {
    const suffix = Number(endRaw)
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(startRaw)
  const end = endRaw ? Math.min(Number(endRaw), size - 1) : size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return 'invalid'
  }
  return { start, end }
}

function rangeUnavailable(size: number): Response {
  return new Response(null, {
    status: 416,
    headers: { 'Content-Range': `bytes */${size}` }
  })
}

async function fileResponse(path: string, request?: Request): Promise<Response> {
  try {
    const body = await readFile(path)
    const size = body.byteLength
    const range = parseRange(request?.headers.get('range') ?? null, size)
    if (range === 'invalid') return rangeUnavailable(size)
    const commonHeaders = {
      'Content-Type': contentType(path),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    }
    if (range) {
      const chunk = body.subarray(range.start, range.end + 1)
      return new Response(request?.method === 'HEAD' ? null : chunk, {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`
        }
      })
    }
    return new Response(request?.method === 'HEAD' ? null : body, {
      status: 200,
      headers: { ...commonHeaders, 'Content-Length': String(size) }
    })
  } catch {
    return new Response('音频缓存不可用', { status: 404 })
  }
}

async function handleFile(url: URL, request: Request): Promise<Response> {
  const encoded = url.pathname.replace(/^\/+/, '')
  const filePath = Buffer.from(encoded, 'base64url').toString('utf8')
  return fileResponse(filePath, request)
}

/** 把主进程音频协议 URL 解析为 mpv 可加载的本地路径或上游地址。 */
export function resolveProtocolSource(protocolUrl: string): string | null {
  try {
    const url = new URL(protocolUrl)
    if (url.protocol !== `${AUDIO_PROTOCOL_SCHEME}:`) return null
    const segment = url.pathname.replace(/^\/+/, '')
    if (url.hostname === 'file') {
      return Buffer.from(segment, 'base64url').toString('utf8')
    }
    if (url.hostname === 'stream') {
      const source = streams.get(segment)
      if (!source) return null
      return getCachedAudio(source.songMid, source.quality) ?? source.url
    }
    return null
  } catch {
    return null
  }
}

async function handleStream(url: URL, request: Request): Promise<Response> {
  const token = url.pathname.replace(/^\/+/, '')
  const source = streams.get(token)
  if (!source) return new Response('音频流不存在', { status: 404 })

  if (getSettings().audioCacheEnabled) {
    const cached = getCachedAudio(source.songMid, source.quality)
    if (cached) return fileResponse(cached, request)
  }

  const rangeHeader = request.headers.get('range')

  try {
    const response = await net.fetch(source.url, {
      headers: {
        Referer: 'https://y.qq.com/',
        ...(rangeHeader ? { Range: rangeHeader } : {})
      }
    })
    if (!response.ok && response.status !== 206) {
      return new Response('音频加载失败', { status: response.status })
    }
    const contentType =
      response.headers.get('content-type') ?? (source.quality === 'flac' ? 'audio/flac' : 'audio/mpeg')
    const acceptRanges = response.headers.get('accept-ranges') ?? 'bytes'
    const contentRange = response.headers.get('content-range')
    const contentLength = response.headers.get('content-length')
    const fullRange = contentRange ? /^bytes 0-(\d+)\/(\d+)$/.exec(contentRange) : null
    const complete =
      response.status === 200 ||
      Boolean(fullRange && Number(fullRange[1]) + 1 === Number(fullRange[2]))
    const baseHeaders = {
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
      'Cache-Control': 'no-store'
    }
    const body = response.body
    if (!body) {
      const buffer = await response.arrayBuffer()
      if (complete) await cacheChunks(source, [new Uint8Array(buffer)])
      return new Response(request.method === 'HEAD' ? null : buffer, {
        status: response.status,
        headers: {
          ...baseHeaders,
          'Content-Length': contentLength ?? String(buffer.byteLength)
        }
      })
    }

    // 局部 Range 直接透传，保证未命中缓存时也能立即 seek。
    if (!complete) {
      return new Response(request.method === 'HEAD' ? null : body, {
        status: response.status,
        headers: baseHeaders
      })
    }

    const chunks: Uint8Array[] = []
    const reader = body.getReader()
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            await cacheChunks(source, chunks)
            return
          }
          if (value) {
            chunks.push(value)
            controller.enqueue(value)
          }
        } catch (error) {
          controller.error(error)
        }
      },
      cancel(reason) {
        void reader.cancel(reason)
      }
    })
    return new Response(request.method === 'HEAD' ? null : stream, {
      status: response.status,
      headers: baseHeaders
    })
  } catch {
    const cached = getCachedAudio(source.songMid, source.quality)
    if (cached) return fileResponse(cached, request)
    return new Response('音频加载失败', { status: 502 })
  }
}

export function registerAudioProtocol(): void {
  protocol.handle(AUDIO_PROTOCOL_SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.hostname === 'file') return handleFile(url, request)
    if (url.hostname === 'stream') return handleStream(url, request)
    return new Response('未知音频地址', { status: 400 })
  })
}

export async function clearAudioTemp(): Promise<void> {
  await rm(tempDir(), { recursive: true, force: true })
}

/** 供下载管理器读取临时音频。 */
export async function readAudioFile(path: string): Promise<Buffer> {
  return readFile(path)
}
