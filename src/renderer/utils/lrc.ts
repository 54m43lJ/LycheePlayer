export interface LyricWord {
  startMs: number
  durationMs: number
  text: string
}

export interface LyricLine {
  timeMs: number
  durationMs: number | null
  text: string
  trans: string | null
  words: LyricWord[] | null
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

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

/** 合并 LRC 与翻译，按时间排序；同一时间戳取首条。 */
export function parseLyric(lrc: string, trans: string | null): LyricLine[] {
  const translation = new Map<number, string>()
  if (trans) {
    for (const line of parsePlain(trans)) {
      if (line.text) translation.set(line.timeMs, line.text)
    }
  }

  const seen = new Set<number>()
  return parsePlain(lrc)
    .filter((line) => {
      if (seen.has(line.timeMs)) return false
      seen.add(line.timeMs)
      return true
    })
    .map((line) => ({
      timeMs: line.timeMs,
      durationMs: null,
      text: line.text,
      trans: translation.get(line.timeMs) ?? null,
      words: null
    }))
    .sort((a, b) => a.timeMs - b.timeMs)
}

export function activeLyricIndex(lines: LyricLine[], positionMs: number): number {
  if (lines.length === 0) return -1
  let low = 0
  let high = lines.length - 1
  let result = -1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lines[mid].timeMs <= positionMs + 80) {
      result = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return result
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
