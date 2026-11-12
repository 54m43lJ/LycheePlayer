export interface LyricWord {
  startMs: number
  durationMs: number
  text: string
}

export interface LyricLine {
  timeMs: number
  durationMs: number | null
  text: string
  /** 是否为翻译行；原文与译文一起按时间排序展示。 */
  translation: boolean
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

function parseTranslationEntries(trans: string | null): TranslationEntry[] {
  if (!trans || !trans.trim()) return []
  const timed = parsePlain(trans).filter((entry) => entry.text.trim().length > 0)
  if (timed.length > 0) return timed.map((entry) => ({ timeMs: entry.timeMs, text: entry.text }))
  return untimedTexts(trans).map((text) => ({ timeMs: null, text }))
}

function translationLines(entries: TranslationEntry[], originals: LyricLine[]): LyricLine[] {
  return entries.map((entry, index) => {
    const fallback = originals[Math.min(index, originals.length - 1)]
    const extraOffset = fallback ? Math.max(0, index - originals.length + 1) : index
    return {
      timeMs: entry.timeMs ?? (fallback?.timeMs ?? 0) + extraOffset,
      durationMs: null,
      text: entry.text,
      translation: true,
      words: null as LyricWord[] | null
    }
  })
}

/** 原文与译文都作为独立时间行，按时间先后排序；同一时间戳原文在前。 */
export function sortLyricLines(lines: LyricLine[]): LyricLine[] {
  return lines.sort((a, b) => a.timeMs - b.timeMs || Number(a.translation) - Number(b.translation))
}

/** 把译文作为独立行并入原文；译文没有时间戳时按行序跟随原文，检测只看文本是否存在。 */
export function withTranslations(lines: LyricLine[], trans: string | null): LyricLine[] {
  return sortLyricLines([...lines, ...translationLines(parseTranslationEntries(trans), lines)])
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
      translation: false,
      words: null
    }))
  // 原文也没有时间戳时按行序生成稳定序号，至少保证原文与译文能按行序展示。
  const originals =
    timed.length > 0
      ? timed
      : untimedTexts(lrc).map((text, index) => ({
          timeMs: index * 1000,
          durationMs: null,
          text,
          translation: false,
          words: null
        }))
  return withTranslations(originals, trans)
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
