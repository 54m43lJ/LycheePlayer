import type { Lyric } from '../../shared/types'
import { UpstreamError, upstreamRequest } from './client'

interface LyricResponse {
  code?: number
  retcode?: number
  lyric?: string
  qrc?: string
  trans?: string
}

/** 歌词接口：QRC 密文只透传，解密与逐字解析在渲染进程完成。 */
export async function getLyric(songMid: string): Promise<Lyric> {
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
