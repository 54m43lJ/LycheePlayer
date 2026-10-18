/// <reference types="vite/client" />

import type { LycheeApi } from '../shared/ipc'

declare global {
  interface Window {
    lychee: LycheeApi
  }
}

export {}
