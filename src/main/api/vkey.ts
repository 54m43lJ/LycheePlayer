import { VKEY_MIN_INTERVAL_MS } from '../../shared/constants'
import { getGuid, mapUpstreamCode, musicu, tripUpstreamBlock, UpstreamError } from './client'

/** 单首歌的取流参数；一次 vkey 请求只允许一首歌。 */
export interface VkeyQuery {
  /** 单首歌的 songMid。 */
  songMid: string
  /** 与当前音质对应的文件名，必须使用 media_mid 拼接。 */
  filename: string
  /** 账号 uin；未登录为 '0'。 */
  uin: string
}

export interface VkeyResult {
  /** 该档位无链接时为空字符串。 */
  purl: string
  /** 上游授权结果码；缺失时为 null。 */
  result: number | null
}

interface VkeyResponse {
  retcode?: number
  msg?: string
  midurlinfo?: Array<{
    songmid?: string
    purl?: string
    result?: number
  }>
}

let lastVkeyAtMs = 0
let vkeyQueue: Promise<void> = Promise.resolve()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * vkey 专用安全 gate：请求串行排队，相邻两次请求的开始时间至少相差
 * VKEY_MIN_INTERVAL_MS；失败不会阻塞后续请求。
 */
async function withVkeyGate<T>(run: () => Promise<T>): Promise<T> {
  const task = vkeyQueue.then(async () => {
    const waitMs = lastVkeyAtMs + VKEY_MIN_INTERVAL_MS - Date.now()
    if (waitMs > 0) await sleep(waitMs)
    lastVkeyAtMs = Date.now()
    return run()
  })
  vkeyQueue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}

async function callVkey(
  module: string,
  method: string,
  param: Record<string, unknown>
): Promise<VkeyResponse> {
  const data = await musicu<VkeyResponse>(module, method, param, { deferBlock: true })
  // 有些响应把具体错误放在 data.retcode，而 req_0.code 为 0。
  const retcode = Number(data.retcode)
  if (Number.isFinite(retcode) && retcode !== 0) {
    throw mapUpstreamCode(retcode, `${module}.${method}`)
  }
  return data
}

/**
 * 获取单曲播放链接。先走经典入口，104009 时尝试备用入口；两个入口都拒绝才触发全局截断。
 * 其他模块不得直接请求 vkey，批量与并发由该入口的结构排除。
 */
export async function fetchVkey(query: VkeyQuery): Promise<VkeyResult> {
  const baseParam = {
    guid: getGuid(),
    songmid: [query.songMid],
    songtype: [0],
    filename: [query.filename],
    uin: query.uin
  }

  let data: VkeyResponse
  try {
    data = await withVkeyGate(() =>
      callVkey('vkey.GetVkeyServer', 'CgiGetVkey', {
        ...baseParam,
        loginflag: 1,
        platform: '20'
      })
    )
  } catch (err) {
    if (!(err instanceof UpstreamError) || err.upstreamCode !== 104009) throw err
    try {
      data = await withVkeyGate(() =>
        callVkey('music.vkey.GetVkey', 'UrlGetVkey', { ...baseParam, ctx: 0 })
      )
    } catch (fallbackError) {
      // 两个 vkey 入口都拒绝时，说明不是单曲问题；进入全局 60 秒截断窗口。
      if (fallbackError instanceof UpstreamError && fallbackError.upstreamCode === 104009) {
        tripUpstreamBlock()
      }
      throw fallbackError
    }
  }

  const info =
    (data.midurlinfo ?? []).find((entry) => entry.songmid === query.songMid) ?? data.midurlinfo?.[0]
  const result = Number(info?.result)
  return {
    purl: info?.purl ?? '',
    result: Number.isFinite(result) ? result : null
  }
}

/** 仅测试使用：重置串行队列与间隔计时。 */
export function resetVkeyGate(): void {
  lastVkeyAtMs = 0
  vkeyQueue = Promise.resolve()
}
