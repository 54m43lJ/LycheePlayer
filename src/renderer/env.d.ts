/// <reference types="vite/client" />

import type { LycheeApi } from '../shared/ipc'

declare global {
  interface Window {
    lychee: LycheeApi
  }

  const __APP_VERSION__: string
  const __APP_LICENSE__: string
}

export {}
