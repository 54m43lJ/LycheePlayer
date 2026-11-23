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

  it('reads MV comments with BizType 5 and the MV vid', async () => {
    const requests: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { param?: Record<string, unknown> }
      }
      requests.push(payload.req_0?.param ?? {})
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [{ CmId: 'm1', Nick: 'M', Content: 'MV 评论', PubTime: 100 }],
              Total: 1,
              HasMore: 0
            }
          }
        }
      })
    })

    const { getMvComments } = await import('../../src/main/api/comment')
    const page = await getMvComments('t0016l53c3r', '')
    expect(page.comments.map((comment) => comment.content)).toEqual(['MV 评论'])
    expect(requests[0]).toMatchObject({
      BizType: 5,
      BizId: 't0016l53c3r'
    })
    expect(requests[0]?.BizSubType).toBeUndefined()
  })

  it('posts an MV comment with BizType 5 and no BizSubType', async () => {
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
          data: { SubCode: 0, Msg: '', AddedCmId: 'new-mv-comment' }
        }
      })
    })

    const { postMvComment } = await import('../../src/main/api/comment')
    await expect(postMvComment('t0016l53c3r', '  hello mv  ')).resolves.toEqual({
      commentId: 'new-mv-comment'
    })
    expect(requests[0]?.method).toBe('AddComment')
    expect(requests[0]?.param).toMatchObject({
      Content: 'hello mv',
      BizType: 5,
      BizId: 't0016l53c3r'
    })
    expect(requests[0]?.param.BizSubType).toBeUndefined()
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

  it('reads replies by root comment id, keeps deleted rows and maps reply targets', async () => {
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
      return new Response(
        '{"code":0,"req_0":{"code":0,"data":{"CommentList":{"Comments":[{"CmId":"r1","Nick":"R","Content":"reply","PubTime":100,"SeqNo":1701807071952960001,"RepliedComments":[{"Nick":"A"}]},{"CmId":"r2","Nick":"","Content":"","PubTime":90,"State":2,"SeqNo":1701807071952960000}],"Total":2,"HasMore":1}}}}',
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })

    const { getCommentReplies } = await import('../../src/main/api/comment')
    const page = await getCommentReplies('root', '')
    expect(requests[0]?.method).toBe('GetReplyCommentList')
    expect(requests[0]?.param).toMatchObject({
      RootCmId: 'root',
      LastCommentSeqNo: '',
      PageSize: 10,
      RankType: 0
    })
    expect(page.comments.map((comment) => comment.id)).toEqual(['r1', 'r2'])
    expect(page.comments[0]).toMatchObject({
      replyToNickname: 'A',
      deleted: false
    })
    expect(page.comments[1]).toMatchObject({
      deleted: true,
      content: ''
    })
    expect(page.nextCursor).toBe('1701807071952960000')
    expect(page.hasMore).toBe(true)
  })

  it('posts replies with RepliedCmId and the target BizType / BizId', async () => {
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
        req_0: { code: 0, data: { SubCode: 0, AddedCmId: `new-${requests.length}` } }
      })
    })

    const { postCommentReply } = await import('../../src/main/api/comment')
    await expect(postCommentReply('song', '123', 'root', ' hello ')).resolves.toEqual({
      commentId: 'new-1'
    })
    expect(requests[0]?.param).toMatchObject({
      Content: 'hello',
      BizType: 1,
      BizId: '123',
      BizSubType: 2,
      RepliedCmId: 'root'
    })

    await expect(postCommentReply('mv', 't0016l53c3r', 'root', 'mv reply')).resolves.toEqual({
      commentId: 'new-2'
    })
    expect(requests[1]?.param).toMatchObject({
      Content: 'mv reply',
      BizType: 5,
      BizId: 't0016l53c3r',
      RepliedCmId: 'root'
    })
    expect(requests[1]?.param.BizSubType).toBeUndefined()
  })

  it('strips C0 / C1 control characters from nicknames and content', async () => {
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
                  Nick: '\u007f\u007f\u007f\u007fT*',
                  Content: '第一行\u0000第二行\u0007',
                  PubTime: 100
                },
                {
                  CmId: 'b',
                  Nick: 'B',
                  Content: '正文',
                  PubTime: 90,
                  RepliedComments: [{ Nick: '\u009f\u0090A' }]
                }
              ],
              Total: 2,
              HasMore: 0
            }
          }
        }
      })
    )

    const { getComments } = await import('../../src/main/api/comment')
    const page = await getComments('123', '')
    expect(page.comments[0]).toMatchObject({
      nickname: 'T*',
      content: '第一行第二行'
    })
    expect(page.comments[1]).toMatchObject({
      nickname: 'B',
      replyToNickname: 'A'
    })
  })

  it('maps deleted top-level comments without dropping empty content', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'a', Nick: '', Content: '', PubTime: 100, State: 2 },
                { CmId: 'b', Nick: 'B', Content: 'normal', PubTime: 90, State: 1 }
              ],
              Total: 2,
              HasMore: 0
            }
          }
        }
      })
    )

    const { getComments } = await import('../../src/main/api/comment')
    const page = await getComments('123', '')
    expect(page.comments.map((comment) => comment.id)).toEqual(['a', 'b'])
    expect(page.comments[0]?.deleted).toBe(true)
    expect(page.comments[1]?.deleted).toBe(false)
  })
})
