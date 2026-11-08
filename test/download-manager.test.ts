import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const { downloadDir, getDetailMock, resolveStreamUrlsMock } = vi.hoisted(() => ({
  downloadDir: '/tmp/opencode/lychee-download-manager-test',
  getDetailMock: vi.fn(),
  resolveStreamUrlsMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'music' ? downloadDir : '/tmp/opencode'),
    getAppPath: () => '/tmp/opencode'
  }
}))

vi.mock('../src/main/credential', () => ({
  getCredential: () => ({ musicid: '1', musickey: 'key', expiredAtMs: null })
}))

vi.mock('../src/main/settings', () => ({
  getSettings: () => ({ downloadDir })
}))

vi.mock('../src/main/api/song', () => ({
  getDetail: getDetailMock,
  resolveStreamUrls: resolveStreamUrlsMock
}))

vi.mock('../src/main/api/availability', () => ({
  peekAvailability: () => new Map()
}))

vi.mock('../src/main/cache/audio', () => ({
  getCachedAudio: () => null,
  getCachedAudioInfo: () => null,
  linkCachedAudio: vi.fn()
}))

afterAll(() => {
  rmSync(downloadDir, { recursive: true, force: true })
})

describe('download/manager startBatch', () => {
  it('enqueues playlist songs without prefetching details and resolves each at dequeue', async () => {
    rmSync(downloadDir, { recursive: true, force: true })
    getDetailMock.mockImplementation(async (mids: string[]) =>
      mids.map((mid) => ({ songMid: mid, name: `Song ${mid}`, album: { mid: 'album' } }))
    )
    resolveStreamUrlsMock.mockRejectedValue(new Error('stop after detail'))

    const { listDownloads, startBatch } = await import('../src/main/download/manager')
    const batch = await startBatch({
      source: 'playlist',
      playlistId: 'playlist-1',
      playlistName: '测试歌单',
      songMids: ['m1', 'm2', 'm3']
    })

    // 入队阶段不请求歌曲详情，任务只带 mid 进入统一队列。
    expect(getDetailMock).not.toHaveBeenCalled()
    expect(batch.total).toBe(3)
    const tasks = await listDownloads()
    expect(tasks.map((task) => task.name)).toEqual(['m1', 'm2', 'm3'])
    expect(tasks.every((task) => task.batchId === batch.id)).toBe(true)

    // 出队时逐首解析歌曲信息，而不是一次性批量预取。
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(getDetailMock).toHaveBeenCalledTimes(3)
    expect(getDetailMock.mock.calls.map(([mids]) => mids)).toEqual([['m1'], ['m2'], ['m3']])
  })

  it('clears downloaded files, partials, covers and records', async () => {
    mkdirSync(downloadDir, { recursive: true })
    for (const mid of ['m1', 'm2', 'm3']) {
      writeFileSync(join(downloadDir, `${mid}.mp3`), 'audio')
      writeFileSync(join(downloadDir, `${mid}.mp3.part`), 'partial')
      writeFileSync(join(downloadDir, `${mid}.jpg`), 'cover')
    }

    const { clearDownloadDirectory, listBatches, listDownloads } = await import(
      '../src/main/download/manager'
    )
    await clearDownloadDirectory()

    expect(await listDownloads()).toEqual([])
    expect(await listBatches()).toEqual([])
    for (const mid of ['m1', 'm2', 'm3']) {
      expect(existsSync(join(downloadDir, `${mid}.mp3`))).toBe(false)
      expect(existsSync(join(downloadDir, `${mid}.mp3.part`))).toBe(false)
      expect(existsSync(join(downloadDir, `${mid}.jpg`))).toBe(false)
    }
  })
})
