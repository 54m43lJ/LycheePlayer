import { describe, expect, it, vi } from 'vitest'
import { fixture } from '../replay'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => ({ musicid: '100', musickey: 'key' })
}))

function respond(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('api/comment', () => {
  it('uses GetNewCommentList without WithHot for the latest comments', async () => {
    const requests: Array<{ method: string; param: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { method?: string; param?: Record<string, unknown> }
      }
      requests.push({
        method: payload.req_0?.method ?? '',
        param: payload.req_0?.param ?? {}
      })
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'b', Nick: 'B', Content: 'second', PubTime: 200, PraiseNum: 2 },
                { CmId: '', Nick: 'X', Content: 'missing id', PubTime: 150 },
                { CmId: 'a', Nick: 'A', Content: 'first', PubTime: 100, PraiseNum: 1 }
              ],
              Total: 3,
              HasMore: 1
            }
          }
        }
      })
    })

    const { getComments } = await import('../../src/main/api/comment')
    const latest = await getComments('123', '')
    expect(requests[0]?.method).toBe('GetNewCommentList')
    expect(requests[0]?.param.WithHot).toBeUndefined()
    expect(latest.comments.map((comment) => comment.id)).toEqual(['b', 'a'])
  })

  it('maps IsPraised / IsLiked to liked and reads comments with the login cookie', async () => {
    let cookie = ''
    let uin = 0
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        comm?: { uin?: number }
      }
      uin = Number(payload.comm?.uin ?? 0)
      cookie = new Headers(init?.headers).get('cookie') ?? ''
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'a', Nick: 'A', Content: 'praised', PubTime: 100, IsPraised: 1 },
                { CmId: 'b', Nick: 'B', Content: 'legacy', PubTime: 200, IsLiked: 1 },
                { CmId: 'c', Nick: 'C', Content: 'none', PubTime: 300 }
              ],
              Total: 3,
              HasMore: 0
            }
          }
        }
      })
    })

    const { getComments } = await import('../../src/main/api/comment')
    const page = await getComments('123', '')
    expect(page.comments.map((comment) => comment.liked)).toEqual([true, true, false])
    expect(uin).toBe(100)
    expect(cookie).toContain('qm_keyst=key')
  })

  it('uses LastCommentSeqNo as the next-page cursor and preserves large SeqNo precision', async () => {
    const params: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { param?: Record<string, unknown> }
      }
      params.push(payload.req_0?.param ?? {})
      if (params.length === 1) {
        return new Response(
          '{"code":0,"req_0":{"code":0,"data":{"CommentList":{"Comments":[{"CmId":"a","Nick":"A","Content":"first","PubTime":100,"SeqNo":1701807071952960512}],"Total":40,"HasMore":1}}}}',
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'b', Nick: 'B', Content: 'second', PubTime: 90, SeqNo: '1701807071952960000' }
              ],
              Total: 40,
              HasMore: 0
            }
          }
        }
      })
    })

    const { getComments } = await import('../../src/main/api/comment')
    const first = await getComments('123', '')
    expect(params[0]?.PageSize).toBe(25)
    expect(first.nextCursor).toBe('1701807071952960512')
    expect(first.hasMore).toBe(true)

    const second = await getComments('123', first.nextCursor ?? '')
    expect(params[1]?.LastCommentSeqNo).toBe('1701807071952960512')
    expect(params[1]?.PageNum).toBe(0)
    expect(second.comments.map((comment) => comment.id)).toEqual(['b'])
    expect(second.hasMore).toBe(false)
  })

  it('maps comment like success', async () => {
    vi.stubGlobal('fetch', async () => respond(fixture('comment-like.json')))
    const { likeComment, unlikeComment } = await import('../../src/main/api/comment')
    await expect(likeComment('c1')).resolves.toEqual({ commentId: 'c1', liked: true })
    await expect(unlikeComment('c1')).resolves.toEqual({ commentId: 'c1', liked: false })
  })
})
