import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const {
  downloadDir,
  getDetailMock,
  resolveStreamUrlsMock,
  getCachedAudioMock,
  copyCachedAudioMock
} = vi.hoisted(() => ({
  downloadDir: '/tmp/opencode/lychee-download-manager-test',
  getDetailMock: vi.fn(),
  resolveStreamUrlsMock: vi.fn(),
  getCachedAudioMock: vi.fn(),
  copyCachedAudioMock: vi.fn()
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
  getCachedAudio: getCachedAudioMock,
  getCachedAudioInfo: () => null,
  copyCachedAudio: copyCachedAudioMock
}))

afterAll(() => {
  rmSync(downloadDir, { recursive: true, force: true })
})

describe('download/manager queue', () => {
  it('enqueues playlist songs without prefetching details and resolves each at dequeue', async () => {
    rmSync(downloadDir, { recursive: true, force: true })
    getDetailMock.mockImplementation(async (mids: string[]) =>
      mids.map((mid) => ({ songMid: mid, name: `Song ${mid}`, album: { mid: 'album' } }))
    )
    resolveStreamUrlsMock.mockRejectedValue(new Error('stop after detail'))

    const { listDownloads, startDownloads } = await import('../src/main/download/manager')
    const started = await startDownloads(['m1', 'm2', 'm3'], 'flac')

    // 入队阶段不请求歌曲详情，任务只带 mid 进入统一队列。
    expect(getDetailMock).not.toHaveBeenCalled()
    expect(started.map((task) => task.name)).toEqual(['m1', 'm2', 'm3'])
    const tasks = await listDownloads()
    expect(tasks.map((task) => task.name)).toEqual(['m1', 'm2', 'm3'])

    // 出队时逐首解析歌曲信息，而不是一次性批量预取。
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(getDetailMock).toHaveBeenCalledTimes(3)
    expect(getDetailMock.mock.calls.map(([mids]) => mids)).toEqual([['m1'], ['m2'], ['m3']])
  })

  it('stores downloads as song-singer-album and sanitizes each part', async () => {
    rmSync(downloadDir, { recursive: true, force: true })
    getDetailMock.mockResolvedValue([
      {
        songMid: 'm9',
        name: '晴天/Live',
        singers: [
          { mid: 's1', name: '周杰伦' },
          { mid: 's2', name: '杨瑞代' }
        ],
        album: { mid: 'a1', name: '叶惠美' }
      }
    ])
    resolveStreamUrlsMock.mockResolvedValue(
      new Map([['m9', { url: 'https://example.test/m9.flac', quality: 'flac' }]])
    )
    getCachedAudioMock.mockReturnValue('/tmp/opencode/m9.flac')
    copyCachedAudioMock.mockImplementation(async (_mid, _quality, target: string) => {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, 'audio')
    })

    const { downloadFileName, listDownloads, startDownload } = await import(
      '../src/main/download/manager'
    )
    expect(downloadFileName('歌', [], '')).toBe('歌')
    expect(downloadFileName('A/B', ['C'], 'D')).toBe('A_B-C-D')

    await startDownload('m9', 'flac')
    await vi.waitFor(async () => {
      const task = (await listDownloads()).find((item) => item.songMid === 'm9')
      expect(task?.status, task?.error).toBe('done')
    })
    const task = (await listDownloads()).find((item) => item.songMid === 'm9')
    expect(task?.filePath).toBe(join(downloadDir, '晴天_Live-周杰伦、杨瑞代-叶惠美.flac'))
    expect(task && existsSync(task.filePath)).toBe(true)
  })

  it('clears downloaded files, partials, covers and records', async () => {
    mkdirSync(downloadDir, { recursive: true })
    for (const mid of ['m1', 'm2', 'm3']) {
      writeFileSync(join(downloadDir, `${mid}.mp3`), 'audio')
      writeFileSync(join(downloadDir, `${mid}.mp3.part`), 'partial')
      writeFileSync(join(downloadDir, `${mid}.jpg`), 'cover')
    }

    const { clearDownloadDirectory, listDownloads } = await import('../src/main/download/manager')
    await clearDownloadDirectory()

    expect(await listDownloads()).toEqual([])
    for (const mid of ['m1', 'm2', 'm3']) {
      expect(existsSync(join(downloadDir, `${mid}.mp3`))).toBe(false)
      expect(existsSync(join(downloadDir, `${mid}.mp3.part`))).toBe(false)
      expect(existsSync(join(downloadDir, `${mid}.jpg`))).toBe(false)
    }
  })
})
