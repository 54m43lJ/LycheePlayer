import { describe, expect, it } from 'vitest'
import type { Comment } from '../src/shared/types'
import { buildCommentSections } from '../src/renderer/utils/comment-sections'

function comment(id: string): Comment {
  return {
    id,
    nickname: id,
    avatarUrl: '',
    content: id,
    likedCount: 0,
    replyCount: 0,
    createdAtMs: 0
  }
}

describe('comment sections', () => {
  it('creates the hot section only when hot comments exist', () => {
    const sections = buildCommentSections([], [comment('a')])

    expect(sections.map((section) => section.key)).toEqual(['latest'])
    expect(sections[0]?.comments.map((item) => item.id)).toEqual(['a'])
  })

  it('puts hot comments first and removes duplicates from the latest section', () => {
    const hot = [comment('b'), comment('a')]
    const latest = [comment('a'), comment('c'), comment('b')]

    const sections = buildCommentSections(hot, latest, 505)

    expect(sections.map((section) => section.title)).toEqual(['热评', '评论'])
    expect(sections[0]?.comments.map((item) => item.id)).toEqual(['b', 'a'])
    expect(sections[1]?.comments.map((item) => item.id)).toEqual(['c'])
    expect(sections.map((section) => section.count)).toEqual([2, 505])
  })
})
