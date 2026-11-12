import type { Lyric } from '../../shared/types'
import { musicu } from './client'

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

/**
 * 歌词接口：PlayLyricInfo 同时返回原文与译文，二者都是 Base64 编码的 LRC。
 * 旧 fcg_query_lyric_new 接口对大量歌曲的 trans 为空，不再作为回退路径。
 */
export async function getLyric(songId: string): Promise<Lyric> {
  const id = songId.trim()
  if (!/^\d+$/.test(id)) return { format: 'lrc', text: '', trans: null }

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
      songID: Number(id),
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
