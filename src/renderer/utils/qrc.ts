import type { LyricLine, LyricWord } from './lrc'

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function decodeBase64(value: string): string | null {
  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function decodeHex(value: string): string | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

function looksLikeQrc(value: string): boolean {
  return value.includes('<QrcInfos') || /^\[\d+,\d+\]/.test(value)
}

/**
 * QRC 解密。上游返回的 QRC 可能是经过 TripleDES 加密的 Base64/十六进制文本；
 * 这里先处理明文 XML 与可逆编码，无法进一步解密时保留原文交给解析器（避免丢歌词）。
 */
export function decryptQrc(ciphertext: string): string {
  const text = ciphertext.trim()
  if (!text) return ''
  if (looksLikeQrc(text)) return text

  const base64 = decodeBase64(text)
  if (base64 && looksLikeQrc(base64)) return base64
  const hex = decodeHex(text)
  if (hex && looksLikeQrc(hex)) return hex

  // 上游 QRC 为 hex 密文：3DES-ECB（无填充）+ zlib；由 preload 在渲染进程内完成。
  if (/^[0-9a-f]+$/i.test(text) && text.length % 16 === 0) {
    try {
      const decrypted = window.lychee.lyric.decryptQrc(text)
      if (looksLikeQrc(decrypted)) return decrypted
    } catch {
      // 非 QRC 密文或解密失败时保留原文。
    }
  }
  return text
}

function extractContent(xml: string): string {
  const match = /LyricContent\s*=\s*"([\s\S]*?)"/.exec(xml)
  if (match) return decodeEntities(match[1])
  const tag = /<LyricContent>([\s\S]*?)<\/LyricContent>/.exec(xml)
  return tag ? decodeEntities(tag[1]) : xml
}

function parseWords(body: string): LyricWord[] {
  const words: LyricWord[] = []
  const pattern = /([^()]+)\((\d+),(\d+)\)/g
  for (const match of body.matchAll(pattern)) {
    const text = match[1]
    if (!text) continue
    words.push({
      startMs: Number(match[2]),
      durationMs: Number(match[3]),
      text
    })
  }
  return words
}

function parseTranslation(trans: string | null): Map<number, string> {
  const map = new Map<number, string>()
  if (!trans) return map
  for (const line of trans.split(/\r?\n/)) {
    const match = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/.exec(line)
    if (!match) continue
    const fraction = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) : 0
    map.set(Number(match[1]) * 60_000 + Number(match[2]) * 1000 + fraction, match[4].trim())
  }
  return map
}

/** 解析 QRC 明文 XML / 行文本；逐字时间轴以字 / 词为单位。 */
export function parseQrcLyric(text: string, trans: string | null): LyricLine[] {
  const content = extractContent(decryptQrc(text))
  const translation = parseTranslation(trans)
  const lines: LyricLine[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    const header = /^\[(\d+),(\d+)\](.*)$/.exec(line)
    if (!header) continue
    const timeMs = Number(header[1])
    const durationMs = Number(header[2])
    const body = header[3]
    const words = parseWords(body)
    const textValue = words.length > 0 ? words.map((word) => word.text).join('') : body
    if (!textValue.trim() && words.length === 0) continue
    lines.push({
      timeMs,
      durationMs,
      text: textValue,
      trans: translation.get(timeMs) ?? null,
      words: words.length > 0 ? words : null
    })
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs)
}
