import { describe, expect, it } from 'vitest'
import { dismissTopPopup, pushBackDismiss } from '../src/renderer/composables/back-navigation'

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
})
