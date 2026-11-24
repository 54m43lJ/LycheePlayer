import { describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import {
  dismissTopPopup,
  goBack,
  goForward,
  installPageHistory,
  pushBackDismiss
} from '../src/renderer/composables/back-navigation'

interface FakeRouter {
  currentRoute: { value: { fullPath: string } }
  afterEach: (callback: (to: { fullPath: string }, from: unknown, failure?: unknown) => void) => () => void
  replace: (path: string) => Promise<void>
}

function fakeRouter(initial: string): {
  router: Router
  navigate: (path: string) => void
  replace: ReturnType<typeof vi.fn>
} {
  let afterEach: ((to: { fullPath: string }, from: unknown, failure?: unknown) => void) | null =
    null
  const router: FakeRouter = {
    currentRoute: { value: { fullPath: initial } },
    afterEach(callback) {
      afterEach = callback
      return () => {
        afterEach = null
      }
    },
    replace: vi.fn(async (path: string) => {
      router.currentRoute.value.fullPath = path
      afterEach?.({ fullPath: path }, {}, undefined)
    })
  }
  return {
    router: router as unknown as Router,
    navigate(path: string) {
      router.currentRoute.value.fullPath = path
      afterEach?.({ fullPath: path }, {}, undefined)
    },
    replace: router.replace as ReturnType<typeof vi.fn>
  }
}

describe('back navigation', () => {
  it('dismisses the most recently opened popup', () => {
    const calls: string[] = []
    const releaseFirst = pushBackDismiss(() => calls.push('first'))
    const releaseSecond = pushBackDismiss(() => calls.push('second'))

    expect(dismissTopPopup()).toBe(true)
    expect(calls).toEqual(['second'])

    releaseSecond()
    expect(dismissTopPopup()).toBe(true)
    expect(calls).toEqual(['second', 'first'])

    releaseFirst()
  })

  it('walks back through visited pages', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/playlist/1')
    navigate('/artist/a')
    goBack()
    expect(replace).toHaveBeenLastCalledWith('/playlist/1')
    goBack()
    expect(replace).toHaveBeenLastCalledWith('/discover')
    goBack()
    expect(replace).toHaveBeenCalledTimes(2)

    remove()
  })

  it('walks forward again after going back', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/playlist/1')
    navigate('/artist/a')
    goBack()
    expect(replace).toHaveBeenLastCalledWith('/playlist/1')
    goForward()
    expect(replace).toHaveBeenLastCalledWith('/artist/a')
    goForward()
    expect(replace).toHaveBeenCalledTimes(2)

    remove()
  })

  it('clears the forward stack on a new navigation', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/playlist/1')
    navigate('/artist/a')
    goBack()
    navigate('/album/b')
    goForward()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenLastCalledWith('/playlist/1')

    remove()
  })

  it('does not navigate forward while a popup is open', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)
    navigate('/playlist/1')
    navigate('/artist/a')
    goBack()

    const release = pushBackDismiss(() => undefined)
    goForward()
    expect(replace).toHaveBeenCalledTimes(1)

    release()
    remove()
  })

  it('lets an open popup consume back without changing pages', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)
    navigate('/playlist/1')

    let dismissed = false
    const release = pushBackDismiss(() => {
      dismissed = true
    })
    goBack()
    expect(dismissed).toBe(true)
    expect(replace).not.toHaveBeenCalled()

    release()
    remove()
  })

  it('does not record the login page in the page stack', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/settings')
    navigate('/login')
    navigate('/library')
    goBack()
    expect(replace).toHaveBeenLastCalledWith('/settings')

    remove()
  })

  it('falls back to the home page for a deep-linked first page', () => {
    const { router, replace } = fakeRouter('/playlist/1')
    const remove = installPageHistory(router)

    goBack()
    expect(replace).toHaveBeenLastCalledWith('/discover')

    remove()
  })

  it('replaces the current entry when only the query changes', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/search')
    navigate('/search?q=a')
    navigate('/search?q=a&type=singer')
    navigate('/search?q=a&type=album')
    goBack()

    expect(replace).toHaveBeenLastCalledWith('/discover')
    goForward()
    expect(replace).toHaveBeenLastCalledWith('/search?q=a&type=album')

    remove()
  })

  it('keeps separate entries for different base paths', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/artist/a?view=albums')
    navigate('/artist/b?view=albums')
    goBack()
    expect(replace).toHaveBeenLastCalledWith('/artist/a?view=albums')

    remove()
  })

  it('ignores a repeated navigation to the current page', () => {
    const { router, navigate, replace } = fakeRouter('/discover')
    const remove = installPageHistory(router)

    navigate('/playlist/1')
    navigate('/playlist/1')
    goBack()
    expect(replace).toHaveBeenLastCalledWith('/discover')

    remove()
  })
})
