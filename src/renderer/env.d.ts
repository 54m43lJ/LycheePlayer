/// <reference types="vite/client" />

import type { QqyApi } from '../shared/ipc'

declare global {
  interface Window {
    qqy: QqyApi
  }
}

export {}
