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

  it('normalizes both real and literal escaped newlines in comment content', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'a', Nick: 'A', Content: '第一行\\n第二行', PubTime: 100 },
                { CmId: 'b', Nick: 'B', Content: '第一行\\r\\n第二行', PubTime: 90 },
                { CmId: 'c', Nick: 'C', Content: '第一行\\r第二行', PubTime: 80 },
                { CmId: 'd', Nick: 'D', Content: '真实\r\n换行', PubTime: 70 }
              ],
              Total: 4,
              HasMore: 0
            }
          }
        }
      })
    )

    const { getComments } = await import('../../src/main/api/comment')
    const page = await getComments('123', '')
    expect(page.comments.map((comment) => comment.content)).toEqual([
      '第一行\n第二行',
      '第一行\n第二行',
      '第一行\n第二行',
      '真实\n换行'
    ])
  })

  it('keeps orphaned object replacement characters for the failure placeholder', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'a', Nick: 'A', Content: '好听哈\uFFFC', PubTime: 100 },
                { CmId: 'b', Nick: 'B', Content: '\uFFFC中间\uFFFC文字', PubTime: 90 },
                { CmId: 'c', Nick: 'C', Content: '\uFFFC', PubTime: 80 }
              ],
              Total: 3,
              HasMore: 0
            }
          }
        }
      })
    )

    const { getComments } = await import('../../src/main/api/comment')
    const page = await getComments('123', '')
    expect(page.comments.map((comment) => comment.content)).toEqual([
      '好听哈\uFFFC',
      '\uFFFC中间\uFFFC文字'
    ])
    expect(page.comments.map((comment) => comment.id)).toEqual(['a', 'b'])
  })

  it('maps comment images and inline emoji and keeps media-only comments', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                {
                  CmId: 'a',
                  Nick: 'A',
                  Content: '好听哈\uFFFC',
                  Pic: 'http://pic.test/a.png',
                  PubTime: 100
                },
                {
                  CmId: 'b',
                  Nick: 'B',
                  Content: '找到\uFFFC宝藏',
                  EmoPic: 'http://emo.test/b.png',
                  PubTime: 90
                },
                {
                  CmId: 'c',
                  Nick: 'C',
                  Content: '',
                  Pic: 'https://pic.test/c.png',
                  PubTime: 80
                },
                {
                  CmId: 'd',
                  Nick: 'D',
                  Content: '',
                  EmoPic: 'https://emo.test/d.gif',
                  PubTime: 70
                },
                {
                  CmId: 'e',
                  Nick: 'E',
                  Content: '\uFFFC',
                  Pic: 'https://pic.test/e.png',
                  PubTime: 60
                },
                {
                  CmId: 'f',
                  Nick: 'F',
                  Content: '原版6',
                  EmoPic: 'https://emo.test/f.png',
                  PubTime: 50
                },
                { CmId: 'g', Nick: 'G', Content: '  ', PubTime: 40 },
                { CmId: 'h', Nick: 'H', Content: '', PubTime: 30 }
              ],
              Total: 8,
              HasMore: 0
            }
          }
        }
      })
    )

    const { getComments } = await import('../../src/main/api/comment')
    const page = await getComments('123', '')
    expect(page.comments.map((comment) => comment.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f'
    ])
    expect(page.comments[0]).toMatchObject({
      content: '好听哈',
      imageUrl: 'https://pic.test/a.png'
    })
    expect(page.comments[1]).toMatchObject({
      content: '找到\uFFFC宝藏',
      emojiUrl: 'https://emo.test/b.png'
    })
    expect(page.comments[2]).toMatchObject({
      content: '',
      imageUrl: 'https://pic.test/c.png'
    })
    expect(page.comments[3]).toMatchObject({
      content: '',
      emojiUrl: 'https://emo.test/d.gif'
    })
    expect(page.comments[4]).toMatchObject({
      content: '',
      imageUrl: 'https://pic.test/e.png'
    })
    expect(page.comments[5]).toMatchObject({
      content: '原版6',
      emojiUrl: 'https://emo.test/f.png'
    })
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

  it('posts a song comment with AddComment and returns the new comment id', async () => {
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
          data: { SubCode: 0, Msg: '', AddedCmId: 'new-comment' }
        }
      })
    })

    const { postComment } = await import('../../src/main/api/comment')
    await expect(postComment('123', '  hello  ')).resolves.toEqual({
      commentId: 'new-comment'
    })
    expect(requests[0]?.method).toBe('AddComment')
    expect(requests[0]?.param).toMatchObject({
      Content: 'hello',
      BizType: 1,
      BizId: '123',
      BizSubType: 2
    })
  })

  it('maps a comment verification requirement to NO_PERMISSION', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({
        code: 0,
        req_0: {
          code: 0,
          data: { SubCode: 10001, Msg: 'need verify', VerifyUrl: 'https://example.test/verify' }
        }
      })
    )

    const { postComment } = await import('../../src/main/api/comment')
    await expect(postComment('123', 'hello')).rejects.toMatchObject({
      code: 'NO_PERMISSION'
    })
  })
})
