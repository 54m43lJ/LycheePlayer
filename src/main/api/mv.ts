import type { MvDetail, MvStream, MvSummary, SearchResult } from '../../shared/types'
import { SEARCH_PAGE_SIZE_DEFAULT } from '../../shared/constants'
import { UpstreamError, musicu } from './client'

interface RawMvSummary {
  v_id?: string
  mv_name?: string
  mv_pic_url?: string
  duration?: number
  singer_list?: Array<{ mid?: string; name?: string }>
  publish_date?: string
  play_count?: number
}

interface MvSearchData {
  body?: {
    mv?: { list?: RawMvSummary[] }
    meta?: { sum?: number; estimate_sum?: number }
  }
}

interface MvInfo {
  mvlist?: Array<{
    mvid?: number | string
    vid?: string
    name?: string
    cover_pic?: string
    desc?: string
    duration?: number
    singers?: Array<{ mid?: string; name?: string }>
    pubdate?: number
    playcnt?: number
  }>
}

interface MvUrlEntry {
  filetype?: number
  code?: number
  fileSize?: number
  freeflow_url?: string[]
  url?: string[]
}

interface MvUrlData {
  [vid: string]: { mp4?: MvUrlEntry[] }
}

function coverUrl(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

function singerLine(list: Array<{ name?: string }> | undefined): string {
  return (list ?? [])
    .map((item) => (item.name ?? '').trim())
    .filter(Boolean)
    .join(' / ')
}

function toSummary(raw: RawMvSummary): MvSummary {
  return {
    mvId: String(raw.v_id ?? ''),
    name: raw.mv_name ?? '',
    singerName: singerLine(raw.singer_list),
    coverUrl: coverUrl(raw.mv_pic_url)
  }
}

/** MV 搜索：复用桌面搜索接口的 search_type:4。 */
export async function searchMv(keyword: string, pageNo: number): Promise<SearchResult> {
  const term = keyword.trim()
  if (!term) return { songs: [], singers: [], albums: [], playlists: [], mvs: [], total: 0 }
  const data = await musicu<MvSearchData>(
    'music.search.SearchCgiService',
    'DoSearchForQQMusicDesktop',
    {
      num_per_page: SEARCH_PAGE_SIZE_DEFAULT,
      page_num: Math.max(1, Math.floor(pageNo) || 1),
      query: term,
      search_type: 4,
      searchid: String(Date.now())
    },
    { comm: false }
  )
  const body = data.body
  if (!body) throw new UpstreamError('UPSTREAM_CHANGED', 'MV 搜索响应缺少 body')
  const mvs = (body.mv?.list ?? [])
    .map(toSummary)
    .filter((item) => item.mvId.length > 0)
  return {
    songs: [],
    singers: [],
    albums: [],
    playlists: [],
    mvs,
    total: Number(body.meta?.sum ?? body.meta?.estimate_sum ?? mvs.length)
  }
}

export async function getMvDetail(mvId: string): Promise<MvDetail> {
  const id = mvId.trim()
  if (!id) throw new UpstreamError('UPSTREAM_CHANGED', 'MV ID 为空')
  const data = await musicu<MvInfo>('MvService.MvInfoProServer', 'GetMvInfoList', {
    vidlist: [id],
    vids: [id],
    from: 'h5.playsong'
  })
  const info = data.mvlist?.[0]
  if (!info) throw new UpstreamError('UPSTREAM_CHANGED', 'MV 详情响应缺少 mvlist')
  return {
    mvId: info.vid || String(info.mvid ?? id),
    name: info.name ?? '',
    singerName: singerLine(info.singers),
    coverUrl: coverUrl(info.cover_pic),
    description: info.desc ?? '',
    publishDate: info.pubdate
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date(Number(info.pubdate) * 1000))
      : ''
  }
}

const QUALITY_ORDER: MvStream['quality'][] = ['fhd', 'hd', 'sd']
const FILETYPE: Record<MvStream['quality'], number> = { fhd: 30, hd: 20, sd: 10 }

function firstUrl(entry: MvUrlEntry): string | null {
  const candidates = [...(entry.freeflow_url ?? []), ...(entry.url ?? [])]
  return candidates.find((url) => Boolean(url)) ?? null
}

/** MV 取流：默认请求最高清晰度，不可用时按 fhd → hd → sd 自动降档。 */
export async function getMvStream(
  mvId: string,
  quality: MvStream['quality']
): Promise<MvStream> {
  const id = mvId.trim()
  if (!id) throw new UpstreamError('UPSTREAM_CHANGED', 'MV ID 为空')
  const data = await musicu<MvUrlData>('gosrf.Stream.MvUrlProxy', 'GetMvUrls', {
    vids: [id],
    vidlist: [id],
    from: 'h5.playsong'
  })
  const entry = data[id] ?? Object.values(data)[0]
  if (!entry) throw new UpstreamError('UPSTREAM_CHANGED', 'MV 取流响应缺少视频信息')

  const start = Math.max(0, QUALITY_ORDER.indexOf(quality))
  for (const candidate of QUALITY_ORDER.slice(start)) {
    const filetype = FILETYPE[candidate]
    const item = (entry.mp4 ?? []).find(
      (mp4) => Number(mp4.filetype) === filetype && Number(mp4.code ?? 0) === 0
    )
    const url = item ? firstUrl(item) : null
    if (url) return { mvId: id, quality: candidate, url }
  }
  return { mvId: id, quality, url: null }
}
