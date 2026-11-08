#!/usr/bin/env node
/**
 * 录制上游 fixture。
 * 用法：node scripts/record-fixtures.mjs --method GET --url "https://..." --out test/fixtures/name.json
 * 录制结果会移除 Cookie、完整播放链接与账号 UIN，只保留结构与展示字段。
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    method: { type: 'string', default: 'GET' },
    data: { type: 'string' },
    cookie: { type: 'string' },
    ua: { type: 'string' }
  }
})

if (!values.url || !values.out) {
  console.error('用法：node scripts/record-fixtures.mjs --url <url> --out <file> [--method POST] [--data <json>]')
  process.exit(1)
}

const headers = {
  Referer: 'https://y.qq.com/',
  'User-Agent':
    values.ua ??
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}
if (values.cookie) headers.Cookie = values.cookie
if (values.data) headers['Content-Type'] = 'application/json'

const response = await fetch(values.url, {
  method: values.method,
  headers,
  body: values.data
})
const text = await response.text()

let parsed
try {
  parsed = JSON.parse(text)
} catch {
  console.error(`响应不是 JSON（HTTP ${response.status}）`)
  process.exit(1)
}

/** 脱敏：移除凭证、账号与完整播放链接。 */
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  const output = {}
  for (const [key, item] of Object.entries(value)) {
    if (/cookie|musickey|refresh_token|access_token|purl|vkey/i.test(key)) continue
    if (key === 'uin' || key === 'musicid') {
      output[key] = 0
      continue
    }
    output[key] = sanitize(item)
  }
  return output
}

const out = resolve(values.out)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, `${JSON.stringify(sanitize(parsed), null, 2)}\n`)
console.log(`已写入 ${out}`)
