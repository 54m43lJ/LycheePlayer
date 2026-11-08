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
  it('uses GetHotCommentList for hot sort and sorts oldest locally', async () => {
    const methods: string[] = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { method?: string }
      }
      methods.push(payload.req_0?.method ?? '')
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            CommentList: {
              Comments: [
                { CmId: 'b', Nick: 'B', Content: 'second', PubTime: 200, PraiseNum: 2 },
                { CmId: 'a', Nick: 'A', Content: 'first', PubTime: 100, PraiseNum: 1 }
              ],
              Total: 2,
              HasMore: 0
            }
          }
        }
      })
    })

    const { getComments } = await import('../../src/main/api/comment')
    const hot = await getComments('123', 'hot', 0)
    expect(methods).toContain('GetHotCommentList')
    expect(hot.comments.map((comment) => comment.id)).toEqual(['b', 'a'])

    const oldest = await getComments('123', 'oldest', 0)
    expect(oldest.comments.map((comment) => comment.id)).toEqual(['a', 'b'])
  })

  it('maps comment like success', async () => {
    vi.stubGlobal('fetch', async () => respond(fixture('comment-like.json')))
    const { likeComment, unlikeComment } = await import('../../src/main/api/comment')
    await expect(likeComment('c1')).resolves.toEqual({ commentId: 'c1', liked: true })
    await expect(unlikeComment('c1')).resolves.toEqual({ commentId: 'c1', liked: false })
  })
})
