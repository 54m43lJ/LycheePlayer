#!/usr/bin/env node
/**
 * 上游可达性探针：不依赖 Electron，验证 POC 依赖的公开接口是否仍然可用。
 * 运行：npm run probe
 */
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}

function hash33(input, seed = 0) {
  let hash = seed
  for (const char of input) hash = (hash << 5) + hash + char.codePointAt(0)
  return 2147483647 & hash
}

async function musicu(module, method, param, comm = { uin: 0, format: 'json', ct: 24, cv: 0 }) {
  const payload = { req_0: { module, method, param } }
  if (comm !== null) payload.comm = comm
  const body = JSON.stringify(payload)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(body)}`
    const response = await fetch(url, {
      headers: { Referer: 'https://y.qq.com/', 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    const code = json.code !== 0 ? json.code : (json.req_0?.code ?? 0)
    if (code === 2001 || code === 104604) {
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt))
      continue
    }
    if (code !== 0) throw new Error(`musicu code ${code} (${module}.${method})`)
    if (!json.req_0) throw new Error('missing req_0')
    return json.req_0.data
  }
  throw new Error('musicu 持续繁忙')
}

async function search(keyword) {
  const data = await musicu(
    'music.search.SearchCgiService',
    'DoSearchForQQMusicDesktop',
    { num_per_page: 20, page_num: 1, query: keyword, search_type: 0 },
    null
  )
  return data.body?.song?.list ?? []
}

async function detail(mid) {
  const data = await musicu('music.pf_song_detail_svr', 'get_song_detail_yqq', {
    song_mid: mid
  })
  return data.track_info
}

async function stream(mid, mediaMid, quality) {
  const types = {
    '128k': ['M500', '.mp3'],
    '320k': ['M800', '.mp3'],
    flac: ['F000', '.flac']
  }
  const [prefix, ext] = types[quality]
  const data = await musicu('vkey.GetVkeyServer', 'CgiGetVkey', {
    guid: '10000',
    songmid: [mid],
    songtype: [0],
    filename: [`${prefix}${mediaMid}${ext}`],
    uin: '0',
    loginflag: 1,
    platform: '20'
  })
  return data.midurlinfo?.[0]?.purl ?? ''
}

async function checkPlaybackUrl(purl) {
  const url = `https://ws.stream.qqmusic.qq.com/${purl}`
  const response = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20_000)
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    status: response.status,
    size: buffer.length,
    signature: buffer.subarray(0, 3).toString('latin1'),
    url
  }
}

async function probeSearchAndPlayback() {
  const keywords = ['儿歌', '纯音乐', '卡农']
  let chosen = null
  for (const keyword of keywords) {
    const songs = await search(keyword)
    for (const song of songs.slice(0, 10)) {
      try {
        const track = await detail(song.mid)
        const mediaMid = track?.file?.media_mid
        if (!mediaMid) continue
        const purl = await stream(song.mid, mediaMid, '128k')
        if (!purl) continue
        chosen = { song, mediaMid, purl }
        break
      } catch {
        // 逐首尝试，直到找到匿名可播样本。
      }
    }
    if (chosen) break
  }
  if (!chosen) throw new Error('未找到匿名可播歌曲')

  record('search', true, `「${chosen.song.name}」 ${chosen.song.mid}`)
  record('song detail', true, `media_mid=${chosen.mediaMid}`)

  const download = await checkPlaybackUrl(chosen.purl)
  record(
    'stream 128k',
    download.status === 200 && download.size > 10_000,
    `${download.status} ${download.size} bytes ${download.signature}`
  )

  const high = await stream(chosen.song.mid, chosen.mediaMid, '320k')
  record('quality gate', high === '', high === '' ? '320k 被上游拒绝（免费账号预期行为）' : '320k 可用')

  const lyricResponse = await fetch(
    `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${chosen.song.mid}&format=json&nobase64=1&trans=1&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`,
    { headers: { Referer: 'https://y.qq.com/', 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) }
  )
  const lyric = await lyricResponse.json()
  record('lyric', Boolean(lyric.lyric), `${(lyric.lyric ?? '').split('\n').length} 行`)
}

async function probePlaylist() {
  const data = await musicu('music.srfDissInfo.DissInfo', 'CgiGetDiss', {
    disstid: 7039749142,
    dirid: 0,
    tag: true,
    song_begin: 0,
    song_num: 5,
    userinfo: true,
    orderlist: true,
    onlysonglist: false
  })
  const title = data.dirinfo?.title ?? ''
  const count = data.songlist?.length ?? 0
  if (!title || count === 0) throw new Error('歌单响应为空')
  record('playlist', true, `${title} · ${count} 首（首页）`)
}

async function probeQr() {
  const url = new URL('https://ssl.ptlogin2.qq.com/ptqrshow')
  const params = {
    appid: '716027609',
    e: '2',
    l: 'M',
    s: '3',
    d: '72',
    v: '4',
    t: String(Math.random()),
    daid: '383',
    pt_3rd_aid: '100497308'
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { Referer: 'https://xui.ptlogin2.qq.com/', 'User-Agent': UA },
    signal: AbortSignal.timeout(15_000)
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  const cookies = response.headers.getSetCookie?.() ?? []
  const qrsig = cookies.find((cookie) => cookie.startsWith('qrsig='))?.split(';')[0]?.slice(6)
  if (!qrsig) throw new Error('缺少 qrsig')
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  record('qr image', isPng && buffer.length > 300, `PNG ${buffer.length} bytes`)

  const pollUrl = new URL('https://ssl.ptlogin2.qq.com/ptqrlogin')
  const pollParams = {
    u1: 'https://graph.qq.com/oauth2.0/login_jump',
    ptqrtoken: String(hash33(qrsig)),
    ptredirect: '0',
    h: '1',
    t: '1',
    g: '1',
    from_ui: '1',
    ptlang: '2052',
    action: `0-0-${Date.now()}`,
    js_ver: '20102616',
    js_type: '1',
    pt_uistyle: '40',
    aid: '716027609',
    daid: '383',
    pt_3rd_aid: '100497308',
    has_onekey: '1'
  }
  for (const [key, value] of Object.entries(pollParams)) pollUrl.searchParams.set(key, value)
  const pollResponse = await fetch(pollUrl, {
    headers: {
      Referer: 'https://xui.ptlogin2.qq.com/',
      'User-Agent': UA,
      Cookie: `qrsig=${qrsig}`
    },
    signal: AbortSignal.timeout(15_000)
  })
  const text = await pollResponse.text()
  const match = text.match(/ptuiCB\('(\d+)'/)
  record('qr poll', Boolean(match), `status=${match?.[1] ?? 'unknown'}（66=待扫码）`)
}

const probes = [probeSearchAndPlayback, probePlaylist, probeQr]

for (const probe of probes) {
  try {
    await probe()
  } catch (error) {
    record(probe.name, false, error instanceof Error ? error.message : String(error))
  }
}

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} probes passed`)
if (failed.length > 0) process.exitCode = 1
