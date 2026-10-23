import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join('test', 'fixtures', name), 'utf8'))
}

/** 用 fixture 替换全局 fetch；返回调用记录。 */
export function replay(data: unknown): Array<{ url: string; init?: RequestInit }> {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })
  return calls
}

export function musicuFixture<T>(data: T, code = 0): unknown {
  return {
    code: 0,
    req_0: { code, data }
  }
}
