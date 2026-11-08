import { describe, expect, it } from 'vitest'
import {
  AUDIO_CACHE_DEFAULT_BYTES,
  AUDIO_CACHE_LIMIT_STEPS_BYTES,
  AUDIO_CACHE_MAX_BYTES,
  normalizeAudioCacheLimitBytes
} from '../src/shared/constants'

const MiB = 1024 * 1024

describe('播放缓存上限档位', () => {
  it('固定为 128M / 256M / 512M / 1G / 1.5G / 2G', () => {
    expect(AUDIO_CACHE_LIMIT_STEPS_BYTES).toEqual([
      128 * MiB,
      256 * MiB,
      512 * MiB,
      1024 * MiB,
      1536 * MiB,
      2048 * MiB
    ])
    expect(AUDIO_CACHE_DEFAULT_BYTES).toBe(AUDIO_CACHE_MAX_BYTES)
  })

  it('保留合法的档位值', () => {
    for (const step of AUDIO_CACHE_LIMIT_STEPS_BYTES) {
      expect(normalizeAudioCacheLimitBytes(step)).toBe(step)
    }
  })

  it('将越界或非档位值归一到最近档位', () => {
    expect(normalizeAudioCacheLimitBytes(100 * MiB)).toBe(128 * MiB)
    expect(normalizeAudioCacheLimitBytes(300 * MiB)).toBe(256 * MiB)
    expect(normalizeAudioCacheLimitBytes(700 * MiB)).toBe(512 * MiB)
    expect(normalizeAudioCacheLimitBytes(900 * MiB)).toBe(1024 * MiB)
    expect(normalizeAudioCacheLimitBytes(1300 * MiB)).toBe(1536 * MiB)
    expect(normalizeAudioCacheLimitBytes(3 * 1024 * MiB)).toBe(2048 * MiB)
  })

  it('非法值回退到默认的 2G', () => {
    expect(normalizeAudioCacheLimitBytes(undefined)).toBe(AUDIO_CACHE_DEFAULT_BYTES)
    expect(normalizeAudioCacheLimitBytes(null)).toBe(AUDIO_CACHE_DEFAULT_BYTES)
    expect(normalizeAudioCacheLimitBytes('512M')).toBe(AUDIO_CACHE_DEFAULT_BYTES)
    expect(normalizeAudioCacheLimitBytes(Number.NaN)).toBe(AUDIO_CACHE_DEFAULT_BYTES)
  })
})
