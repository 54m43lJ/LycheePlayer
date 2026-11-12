import type { Lyric } from '../../shared/types'
import { UpstreamError, musicu, upstreamRequest } from './client'

interface LyricResponse {
  code?: number
  retcode?: number
  lyric?: string
  qrc?: string
  trans?: string
}

interface PlayLyricInfoData {
  lyric?: string
  trans?: string
}

function decodeBase64Text(value: string | undefined): string {
  const text = (value ?? '').trim()
  if (!text) return ''
  if (text.includes('[00:') || text.includes('<QrcInfos')) return text
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(text)) return text
  const decoded = Buffer.from(text, 'base64').toString('utf8')
  return decoded.includes('\uFFFD') ? text : decoded
}

/** 新版歌词接口：同时返回原文与翻译，翻译是独立于原文的 LRC 文本。 */
async function getPlayLyricInfo(songId: string): Promise<Lyric> {
  const data = await musicu<PlayLyricInfoData>(
    'music.musichallSong.PlayLyricInfo',
    'GetPlayLyricInfo',
    {
      trans_t: 0,
      roma_t: 0,
      crypt: 0,
      lrc_t: 0,
      interval: 0,
      trans: 1,
      ct: 6,
      singerName: '',
      type: 0,
      qrc_t: 0,
      cv: 80600,
      roma: 1,
      songID: Number(songId),
      qrc: 0,
      albumName: '',
      songName: ''
    }
  )
  const text = decodeBase64Text(data.lyric)
  const trans = decodeBase64Text(data.trans)
  return {
    format: 'lrc',
    text,
    trans: trans.trim().length > 0 ? trans : null
  }
}

/** 旧版歌词接口：保留 QRC 与无数字 songId 时的回退路径。 */
async function getLegacyLyric(songMid: string): Promise<Lyric> {
  const data = await upstreamRequest<LyricResponse>({
    host: 'https://c.y.qq.com',
    path: '/lyric/fcgi-bin/fcg_query_lyric_new.fcg',
    params: {
      songmid: songMid,
      format: 'json',
      nobase64: '1',
      trans: '1',
      g_tk: '5381',
      loginUin: '0',
      hostUin: '0',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: '0',
      platform: 'yqq.json',
      needNewCode: '0'
    }
  })

  if (data.code === -1901 || data.retcode === -1901) {
    // -1901：上游没有匹配到歌词（含纯音乐/无歌词）。属于“无歌词”，不是请求失败。
    return { format: 'lrc', text: '', trans: null }
  }
  if ((data.code ?? 0) !== 0 || (data.retcode ?? 0) !== 0) {
    const code = (data.code ?? 0) !== 0 ? data.code : data.retcode
    throw new UpstreamError('UPSTREAM_CHANGED', `歌词接口返回错误码 ${code}`)
  }
  const trans = data.trans && data.trans.trim().length > 0 ? data.trans : null
  if (data.qrc && data.qrc.trim().length > 0) {
    return { format: 'qrc', text: data.qrc, trans }
  }
  return { format: 'lrc', text: data.lyric ?? '', trans }
}

/**
 * 歌词优先走新版 PlayLyricInfo：旧接口经常只给原文、trans 为空。
 * 新版失败或没有数字 songId 时回退旧接口，保留 QRC 与既有兜底能力。
 */
export async function getLyric(songMid: string, songId = ''): Promise<Lyric> {
  const mid = songMid.trim()
  if (!mid) return { format: 'lrc', text: '', trans: null }
  if (/^\d+$/.test(songId)) {
    try {
      const lyric = await getPlayLyricInfo(songId)
      if (lyric.text.trim().length > 0 || lyric.trans) return lyric
    } catch {
      // 新版接口失败时继续走旧接口，不把歌词整体判为失败。
    }
  }
  return getLegacyLyric(mid)
}
