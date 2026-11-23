export interface LyricWord {
  startMs: number
  durationMs: number
  text: string
}

export interface LyricLine {
  timeMs: number
  durationMs: number | null
  text: string
  /** 与原文同一行的译文；按行序配对，不依赖时间戳完全一致。 */
  trans: string | null
  words: LyricWord[] | null
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const META_TAG = /^\[[a-z]+:.*\]$/i

function parseTimestamp(minutes: string, seconds: string, fraction?: string): number {
  const fractionMs = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0
  return Number(minutes) * 60_000 + Number(seconds) * 1000 + fractionMs
}

function parsePlain(lrc: string): Array<{ timeMs: number; text: string }> {
  const lines: Array<{ timeMs: number; text: string }> = []
  for (const rawLine of lrc.split(/\r?\n/)) {
    const tags = [...rawLine.matchAll(TIME_TAG)]
    if (tags.length === 0) continue
    const text = rawLine.replace(TIME_TAG, '').trim()
    for (const tag of tags) {
      lines.push({
        timeMs: parseTimestamp(tag[1], tag[2], tag[3]),
        text
      })
    }
  }
  return lines
}

function untimedTexts(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(TIME_TAG, '').trim())
    .filter((line) => line.length > 0 && !META_TAG.test(line))
}

interface TranslationEntry {
  timeMs: number | null
  text: string
}

/** 上游用纯斜杠表示无译文占位，规范化为空行并保留行序。 */
function normalizeTranslationText(text: string): string {
  const value = text.trim()
  return /^\/+$/.test(value) ? '' : value
}

function parseTranslationEntries(trans: string | null): TranslationEntry[] {
  if (!trans || !trans.trim()) return []
  // 时间戳译文保留空行条目；匹配阶段再按原文时间戳决定是否使用。
  const timed = parsePlain(trans).map((entry) => ({
    timeMs: entry.timeMs,
    text: entry.text
  }))
  if (timed.length > 0) return timed
  return untimedTexts(trans).map((text) => ({ timeMs: null, text }))
}

/** 译文与原文时间戳的匹配容差；超出则认为该译文没有对应原文行。 */
const TRANSLATION_TIME_TOLERANCE_MS = 100

/**
 * 译文附加顺序：
 * 1. 原文有时间戳时，按时间戳为每条原文寻找最近的未使用译文，超出容差则留空；
 *    原文不存在的多余译文行（含空行）直接忽略。
 * 2. 原文或译文没有时间戳时，退化为按行序配对。
 * 3. 匹配完成后再把纯斜杠占位转义为空字符串；渲染层只输出非空译文。
 */
export function withTranslations(
  lines: LyricLine[],
  trans: string | null,
  timed = true
): LyricLine[] {
  const entries = parseTranslationEntries(trans)
  if (entries.length === 0) return lines
  const timedEntries = entries.filter(
    (entry): entry is TranslationEntry & { timeMs: number } => entry.timeMs !== null
  )

  if (!timed || timedEntries.length === 0) {
    return lines.map((line, index) => {
      const entry = entries[index]
      return { ...line, trans: entry ? normalizeTranslationText(entry.text) : null }
    })
  }

  const used = new Set<number>()
  return lines.map((line) => {
    let best = -1
    let bestDelta = Number.POSITIVE_INFINITY
    timedEntries.forEach((entry, index) => {
      if (used.has(index)) return
      const delta = Math.abs(entry.timeMs - line.timeMs)
      if (delta <= TRANSLATION_TIME_TOLERANCE_MS && delta < bestDelta) {
        best = index
        bestDelta = delta
      }
    })
    if (best < 0) return { ...line, trans: null }
    used.add(best)
    return { ...line, trans: normalizeTranslationText(timedEntries[best].text) }
  })
}

/** 合并 LRC 与翻译，按时间排序；同一时间戳原文取首条。 */
export function parseLyric(lrc: string, trans: string | null): LyricLine[] {
  const seen = new Set<number>()
  const timed = parsePlain(lrc)
    .filter((line) => {
      if (seen.has(line.timeMs)) return false
      seen.add(line.timeMs)
      return true
    })
    .map((line) => ({
      timeMs: line.timeMs,
      durationMs: null,
      text: line.text,
      trans: null,
      words: null
    }))
  // 原文也没有时间戳时按行序生成稳定序号，至少保证原文与译文能按行序展示。
  const hasTimestamps = timed.length > 0
  const originals =
    hasTimestamps
      ? timed
      : untimedTexts(lrc).map((text, index) => ({
          timeMs: index * 1000,
          durationMs: null,
          text,
          trans: null,
          words: null
        }))
  return withTranslations(originals, trans, hasTimestamps)
}

/** 在按时间排序的行里取离当前位置最近的一行；最多提前 80ms 进入下一行。 */
export function activeLyricIndex(lines: LyricLine[], positionMs: number): number {
  if (lines.length === 0) return -1
  let low = 0
  let high = lines.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (lines[mid].timeMs <= positionMs + 80) low = mid + 1
    else high = mid
  }
  const last = low - 1
  if (last < 0) return -1
  const candidates = last > 0 ? [last - 1, last] : [last]
  let best = last
  for (const index of candidates) {
    if (Math.abs(lines[index].timeMs - positionMs) < Math.abs(lines[best].timeMs - positionMs)) {
      best = index
    }
  }
  return best
}

export function activeLyricWord(line: LyricLine, positionMs: number): LyricWord | null {
  if (!line.words || line.words.length === 0) return null
  let active: LyricWord | null = null
  for (const word of line.words) {
    if (word.startMs <= positionMs) active = word
    else break
  }
  return active
}
