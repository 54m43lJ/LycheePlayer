import type { Lyric } from '../../shared/types'
import { UpstreamError, upstreamRequest } from './client'

interface LyricResponse {
  code?: number
  retcode?: number
  lyric?: string
  trans?: string
}

/** 旧版歌词接口返回明文 LRC；当前不实现 QRC 解密。 */
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
    return { lrc: '', trans: null }
  }
  if ((data.code ?? 0) !== 0 || (data.retcode ?? 0) !== 0) {
    const code = (data.code ?? 0) !== 0 ? data.code : data.retcode
    throw new UpstreamError('UPSTREAM_CHANGED', `歌词接口返回错误码 ${code}`)
  }
  return {
    lrc: data.lyric ?? '',
    trans: data.trans && data.trans.trim().length > 0 ? data.trans : null
  }
}
